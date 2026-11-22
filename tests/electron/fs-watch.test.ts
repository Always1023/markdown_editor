// @vitest-environment node
// I-008 机检探针：chokidar watcher → FsChangedPayload 映射（临时目录，结束清理）。
// sender 用 Orca filesystem-watcher-test-sender 的形状（mock webContents）。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile, appendFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  closeAllWatchersForTest,
  getWatchedRootCount,
  subscribeLocalWatcher,
  unsubscribeLocalWatcher,
  type WatcherSender
} from '../../electron/main/fs-watch'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'me-watch-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
})

afterAll(async () => {
  await closeAllWatchersForTest()
  delete process.env['MARKDOWN_EDITOR_ROOTS']
})

type RecordedPayload = {
  worktreePath: string
  events: Array<{ kind: string; absolutePath: string; isDirectory?: boolean }>
}

function makeSender(id: number): WatcherSender & { payloads: RecordedPayload[] } {
  const payloads: RecordedPayload[] = []
  return {
    id,
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => {
      if (channel === 'fs:changed') {
        payloads.push(payload as RecordedPayload)
      }
    },
    payloads
  }
}

/** Poll until the predicate holds; watcher batches flush within ~175ms, 5s is a safe ceiling. */
async function waitFor(predicate: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (predicate()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`等待超时：${what}`)
}

function allEvents(payloads: RecordedPayload[]): RecordedPayload['events'] {
  return payloads.flatMap((payload) => payload.events)
}

describe('I-008 A1 事件推送', () => {
  it('写入 / 追加 / 删除文件产生对应 kind 与路径的载荷', async () => {
    const sender = makeSender(1)
    await subscribeLocalWatcher(root, sender)

    const target = join(root, 'note.md')
    await writeFile(target, 'v1', 'utf-8')
    await waitFor(
      () =>
        allEvents(sender.payloads).some(
          (evt) => evt.kind === 'create' && evt.absolutePath === target
        ),
      'create note.md'
    )

    await appendFile(target, '-more', 'utf-8')
    await waitFor(
      () =>
        allEvents(sender.payloads).some(
          (evt) => evt.kind === 'update' && evt.absolutePath === target
        ),
      'update note.md'
    )

    await rm(target)
    await waitFor(
      () =>
        allEvents(sender.payloads).some(
          (evt) => evt.kind === 'delete' && evt.absolutePath === target
        ),
      'delete note.md'
    )

    // 目录创建：isDirectory 标记为 true（stat 判定）。
    const subDir = join(root, 'sub')
    await mkdir(subDir)
    await waitFor(
      () =>
        allEvents(sender.payloads).some(
          (evt) => evt.kind === 'create' && evt.absolutePath === subDir && evt.isDirectory === true
        ),
      'create sub/'
    )
    await unsubscribeLocalWatcher(root, 1)
  })
})

describe('I-008 A2 防抖合并', () => {
  it('100ms 内连续写同一文件多次，合并后该路径 update 载荷 ≤ 2', async () => {
    const sender = makeSender(2)
    await subscribeLocalWatcher(root, sender)
    const target = join(root, 'churn.md')
    await writeFile(target, 'seed', 'utf-8')
    await waitFor(
      () => allEvents(sender.payloads).some((evt) => evt.absolutePath === target),
      'seed churn.md'
    )
    sender.payloads.length = 0

    for (let i = 0; i < 5; i++) {
      await writeFile(target, `round-${i}`, 'utf-8')
    }
    await waitFor(() => sender.payloads.length > 0, 'first churn flush')
    // 允许慢机器跨第二个窗口；Orca 双窗语义（75ms leading / 100ms interval）下 ≤ 2。
    const updates = allEvents(sender.payloads).filter(
      (evt) => evt.kind === 'update' && evt.absolutePath === target
    )
    expect(updates.length).toBeLessThanOrEqual(2)
    await unsubscribeLocalWatcher(root, 2)
  })
})

describe('I-008 A3 停止与幂等', () => {
  it('unwatch 后不再推送；同目录重复 watch 只建一个 watcher', async () => {
    const senderA = makeSender(3)
    const senderB = makeSender(4)
    await subscribeLocalWatcher(root, senderA)
    await subscribeLocalWatcher(root, senderB)
    expect(getWatchedRootCount()).toBe(1)

    const target = join(root, 'shared.md')
    await writeFile(target, 'v1', 'utf-8')
    await waitFor(
      () => allEvents(senderA.payloads).some((evt) => evt.absolutePath === target),
      'both senders see create'
    )
    expect(allEvents(senderB.payloads).some((evt) => evt.absolutePath === target)).toBe(true)
    senderA.payloads.length = 0

    await unsubscribeLocalWatcher(root, 3)
    await appendFile(target, '-x', 'utf-8')
    await waitFor(
      () => allEvents(senderB.payloads).some((evt) => evt.kind === 'update'),
      'remaining sender still sees update'
    )
    expect(allEvents(senderA.payloads).length).toBe(0)
    await unsubscribeLocalWatcher(root, 4)
    expect(getWatchedRootCount()).toBe(0)
  })
})

describe('I-008 A4 资源回收', () => {
  it('unwatch 后 watcher 关闭，临时目录可整树删除', async () => {
    const sender = makeSender(5)
    await subscribeLocalWatcher(root, sender)
    const target = join(root, 'a.md')
    await writeFile(target, 'x', 'utf-8')
    await waitFor(() => allEvents(sender.payloads).length > 0, 'watcher active')
    await unsubscribeLocalWatcher(root, 5)
    expect(getWatchedRootCount()).toBe(0)
    // Windows 上未关闭的 watcher 句柄会阻止删除：rm 成功即句柄已释放（A4 判据）。
    await rm(root, { recursive: true, force: false })
  })
})

describe('I-008 越权 watch 拒绝', () => {
  it('工作根之外的目录 watch 被拒', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'me-outside-'))
    try {
      await expect(subscribeLocalWatcher(outside, makeSender(6))).rejects.toThrow(/越出工作目录/)
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})

describe('I-008 ignored 目录', () => {
  it('node_modules / .git 下的变更不推送', async () => {
    const sender = makeSender(7)
    await subscribeLocalWatcher(root, sender)
    const noise = join(root, 'node_modules', 'pkg')
    await mkdir(noise, { recursive: true })
    await writeFile(join(noise, 'index.js'), 'x', 'utf-8')
    const dotGit = join(root, '.git')
    await mkdir(dotGit, { recursive: true })
    await writeFile(join(dotGit, 'HEAD'), 'ref: x', 'utf-8')
    // 有变更也只可能是根下的非忽略文件；给足窗口后断言零事件。
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(allEvents(sender.payloads).length).toBe(0)
    await unsubscribeLocalWatcher(root, 7)
  })
})

vi.restoreAllMocks()
