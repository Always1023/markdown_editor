// 本地文件 watch（I-008）：chokidar → FsChangedPayload 推送渲染端。
// Orca watcher 语义的本地单窗口子集——rootKey 单例幂等（A3）、listeners 空即
// teardown（A4）、双窗防抖合并瞬时写入风暴（A2）、5000 事件上限改发 overflow；
// WSL 子进程隔离 / generation / removal gate 属远端形态，本地不引入。
import { watch, type FSWatcher } from 'chokidar'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  FsChangeEvent,
  FsChangedPayload
} from '@/shared/file-watch/filesystem-change-event'
import { watchBatchFlushDelayMs } from '@/shared/file-watch/filesystem-watch-batch-window'
import { mapWithConcurrency } from '@/shared/concurrency/map-with-concurrency'
import { requirePathInWorkRoots } from './files'

// 高频排除目录，沿 Orca / VS Code 递归 watch 默认（node_modules、.git 等）。
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  'target',
  '.venv',
  '__pycache__',
  '.dart_tool',
  '.gradle',
  '.turbo'
])

// 单批事件上限：超过则一次保守 overflow 刷新替代逐路径合并与 stat（Orca 语义）。
const MAX_BATCHED_WATCHER_EVENTS = 5_000
// watch 目录数上限：防泄漏容量闸（issue 机制层 A4 相邻约束）。
const MAX_WATCHED_ROOTS = 8
// flush 时 stat 并发上限，给 Git 与持久化留 libuv 共享池。
const DIRECTORY_STAT_CONCURRENCY = 8

// 渲染端发送端口的本地抽象：WebContents 结构兼容，测试可注入 mock。
export type WatcherSender = {
  id: number
  isDestroyed(): boolean
  send(channel: string, payload: unknown): void
}

type RawWatcherEvent = { type: 'create' | 'update' | 'delete'; path: string }

type WatchBatch = {
  events: RawWatcherEvent[]
  timer: NodeJS.Timeout | null
  lastFlushAt: number
  overflowed: boolean
  cancelled: boolean
  flushInFlight: boolean
  flushQueued: boolean
}

type WatchedRoot = {
  rootPath: string
  watcher: FSWatcher
  listeners: Map<number, WatcherSender>
  batch: WatchBatch
}

const watchedRoots = new Map<string, WatchedRoot>()

export function getWatchedRootCount(): number {
  return watchedRoots.size
}

/** path 的任一中间段命中忽略名单即忽略；第一段是盘符或根本身，永不忽略。 */
function isIgnoredPath(path: string): boolean {
  const segments = path.split(/[\\/]+/)
  for (let i = 1; i < segments.length; i++) {
    if (IGNORED_DIRS.has(segments[i]!)) {
      return true
    }
  }
  return false
}

// delete→create 保留两者（子树/父目录刷新用）；create→delete 窗口内相消（Orca 语义）。
function coalesceEvents(
  raw: RawWatcherEvent[]
): { type: 'create' | 'update' | 'delete'; path: string }[] {
  const lastByPath = new Map<string, { type: 'create' | 'update' | 'delete'; index: number }>()
  const deleteBeforeCreate = new Set<string>()

  for (let i = 0; i < raw.length; i++) {
    const evt = raw[i]!
    const p = resolve(evt.path)
    const prev = lastByPath.get(p)

    if (prev) {
      if (prev.type === 'delete' && evt.type === 'create') {
        deleteBeforeCreate.add(p)
      }
      if (prev.type === 'create' && evt.type === 'delete') {
        lastByPath.delete(p)
        deleteBeforeCreate.delete(p)
        continue
      }
    }

    lastByPath.set(p, { type: evt.type, index: i })

    // 后续事件可取代 delete→create；不保留其过期 delete。
    if (evt.type !== 'create' && deleteBeforeCreate.has(p)) {
      deleteBeforeCreate.delete(p)
    }
  }

  const result: { type: 'create' | 'update' | 'delete'; path: string }[] = []
  for (const p of deleteBeforeCreate) {
    result.push({ type: 'delete', path: p })
  }
  for (const [p, entry] of lastByPath) {
    result.push({ type: entry.type, path: p })
  }
  return result
}

async function tryStatIsDirectory(filePath: string): Promise<boolean | undefined> {
  try {
    return (await stat(filePath)).isDirectory()
  } catch {
    // stat 失败让渲染端走保守的文件事件默认。
    return undefined
  }
}

function emitOverflowPayload(root: WatchedRoot): void {
  const payload: FsChangedPayload = {
    worktreePath: root.rootPath,
    events: [{ kind: 'overflow', absolutePath: root.rootPath }]
  }
  sendToListeners(root, payload)
}

function sendToListeners(root: WatchedRoot, payload: FsChangedPayload): void {
  for (const [, wc] of root.listeners) {
    if (!wc.isDestroyed()) {
      wc.send('fs:changed', payload)
    }
  }
}

async function flushBatch(root: WatchedRoot): Promise<void> {
  if (root.batch.cancelled) {
    return
  }
  if (root.batch.flushInFlight) {
    root.batch.flushQueued = true
    return
  }

  root.batch.flushInFlight = true
  if (root.batch.timer) {
    clearTimeout(root.batch.timer)
    root.batch.timer = null
  }
  const overflowed = root.batch.overflowed
  const rawEvents = root.batch.events.splice(0)
  root.batch.overflowed = false
  root.batch.lastFlushAt = Date.now()

  try {
    if ((rawEvents.length === 0 && !overflowed) || root.listeners.size === 0) {
      return
    }

    if (overflowed || rawEvents.length > MAX_BATCHED_WATCHER_EVENTS) {
      // 大规模删除风暴用一次保守刷新替代逐路径合并与 stat。
      if (!root.batch.cancelled) {
        emitOverflowPayload(root)
      }
      return
    }

    const coalesced = coalesceEvents(rawEvents)
    const events: FsChangeEvent[] = await mapWithConcurrency(
      coalesced,
      DIRECTORY_STAT_CONCURRENCY,
      async (evt) => ({
        kind: evt.type,
        absolutePath: evt.path,
        // 已删除路径无法 stat；渲染端自行从目录缓存推断。
        isDirectory:
          root.batch.cancelled || root.listeners.size === 0 || evt.type === 'delete'
            ? undefined
            : await tryStatIsDirectory(evt.path)
      })
    )

    if (root.batch.cancelled || root.listeners.size === 0) {
      return
    }

    sendToListeners(root, { worktreePath: root.rootPath, events })
  } finally {
    root.batch.flushInFlight = false
    if (root.batch.flushQueued) {
      root.batch.flushQueued = false
      if (
        !root.batch.cancelled &&
        // 已 armed 的 flush 拥有当前窗口；提前排空会拆散相关事件。
        !root.batch.timer &&
        (root.batch.events.length > 0 || root.batch.overflowed)
      ) {
        void flushBatch(root)
      }
    }
  }
}

function scheduleLocalBatchFlush(root: WatchedRoot): void {
  if (root.batch.cancelled) {
    return
  }
  if (root.batch.flushInFlight) {
    root.batch.flushQueued = true
  }
  // 重置已 armed 的计时器会在持续写入下饿死投递；保留当前窗口。
  if (root.batch.timer) {
    return
  }
  root.batch.timer = setTimeout(
    () => {
      root.batch.timer = null
      void flushBatch(root)
    },
    watchBatchFlushDelayMs(Date.now(), root.batch.lastFlushAt)
  )
}

function queueRawEvent(root: WatchedRoot, event: RawWatcherEvent): void {
  if (root.batch.cancelled) {
    return
  }
  if (root.batch.events.length + 1 > MAX_BATCHED_WATCHER_EVENTS) {
    root.batch.overflowed = true
    return
  }
  root.batch.events.push(event)
  scheduleLocalBatchFlush(root)
}

function teardownRoot(rootKey: string, root: WatchedRoot): void {
  root.batch.cancelled = true
  if (root.batch.timer) {
    clearTimeout(root.batch.timer)
    root.batch.timer = null
  }
  watchedRoots.delete(rootKey)
  void root.watcher.close().catch((error) => {
    console.error(`[fs-watch] 关闭 watcher 失败 ${rootKey}:`, error)
  })
}

/** 订阅一个工作目录的变更推送；同目录幂等（追加 listener），超容量抛错。 */
export async function subscribeLocalWatcher(
  worktreePath: string,
  sender: WatcherSender
): Promise<void> {
  const rootPath = requirePathInWorkRoots(worktreePath)
  const rootKey = resolve(rootPath)

  if (!watchedRoots.has(rootKey) && watchedRoots.size >= MAX_WATCHED_ROOTS) {
    throw new Error(`[fs-watch] watch 目录数已达上限（${MAX_WATCHED_ROOTS}），拒绝新监听`)
  }

  const existing = watchedRoots.get(rootKey)
  if (existing) {
    // 惰性清理已销毁的窗口；活窗口加入监听（幂等）。
    for (const [id, listener] of existing.listeners) {
      if (listener.isDestroyed()) {
        existing.listeners.delete(id)
      }
    }
    existing.listeners.set(sender.id, sender)
    return
  }

  const batch: WatchBatch = {
    events: [],
    timer: null,
    lastFlushAt: 0,
    overflowed: false,
    cancelled: false,
    flushInFlight: false,
    flushQueued: false
  }
  const root: WatchedRoot = {
    rootPath,
    watcher: null!,
    listeners: new Map([[sender.id, sender]]),
    batch
  }

  const watcher = watch(rootPath, {
    ignoreInitial: true,
    ignored: isIgnoredPath,
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 25
    }
  })

  watcher.on('add', (path) => queueRawEvent(root, { type: 'create', path }))
  watcher.on('change', (path) => queueRawEvent(root, { type: 'update', path }))
  watcher.on('unlink', (path) => queueRawEvent(root, { type: 'delete', path }))
  watcher.on('addDir', (path) => queueRawEvent(root, { type: 'create', path }))
  watcher.on('unlinkDir', (path) => queueRawEvent(root, { type: 'delete', path }))
  watcher.on('error', (error) => {
    // 错误使路径精度失效；发保守 overflow 刷新而非静默丢失（失败可见）。
    console.error(`[fs-watch] watcher error for ${rootKey}:`, error)
    if (!root.batch.cancelled) {
      root.batch.overflowed = true
      scheduleLocalBatchFlush(root)
    }
  })

  root.watcher = watcher
  // 先占位（并发 subscribe 幂等可命中），等 ready 后订阅才算生效——
  // 否则 ready 前的写入会被初始扫描吞掉（ignoreInitial），只剩残余 change。
  watchedRoots.set(rootKey, root)
  await new Promise<void>((resolveReady, rejectReady) => {
    watcher.once('ready', () => resolveReady())
    watcher.once('error', (error) => rejectReady(error))
  })
  // 等待期间可能已被 unwatch（teardown 置 cancelled 并关 watcher）。
  if (root.batch.cancelled) {
    return
  }
}

/** 移除某窗口对某目录的监听；最后一个 listener 移除后关闭 watcher 并释放句柄。 */
export function unsubscribeLocalWatcher(worktreePath: string, senderId: number): void {
  const rootKey = resolve(worktreePath)
  const root = watchedRoots.get(rootKey)
  if (!root) {
    return
  }
  root.listeners.delete(senderId)
  if (root.listeners.size === 0) {
    teardownRoot(rootKey, root)
  }
}

/** 关闭全部 watcher（窗口全关 / 测试收尾）：句柄不释会挂住进程与目录删除。 */
export async function closeAllWatchers(): Promise<void> {
  const roots = [...watchedRoots.entries()]
  watchedRoots.clear()
  await Promise.all(
    roots.map(async ([rootKey, root]) => {
      root.batch.cancelled = true
      if (root.batch.timer) {
        clearTimeout(root.batch.timer)
        root.batch.timer = null
      }
      try {
        await root.watcher.close()
      } catch (error) {
        console.error(`[fs-watch] 关闭 watcher 失败 ${rootKey}:`, error)
      }
    })
  )
}

/** 测试收尾别名：语义同 closeAllWatchers。 */
export const closeAllWatchersForTest = closeAllWatchers
