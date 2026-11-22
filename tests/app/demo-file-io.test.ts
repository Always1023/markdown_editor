// @vitest-environment node
// I-009 机检探针：demo 文件 IO 组装层接真实磁盘（window.api.fs 直连 electron/main 的
// 本地实现，CAS / 越权语义与运行时一致；临时目录结束清理）。
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  readTextFile,
  statFile,
  pathExists,
  writeTextFile,
  deletePath
} from '../../electron/main/files'
import { createEditorStore } from '../../src/components/editor/autosave/editor-autosave-controller-test-fixture'
import { getDiskBaselineSignature } from '../../src/shared/file-write/disk-baseline-signature'
import {
  DEMO_WORKTREE_ID,
  installDemoWorkspaceState,
  startDemoFileIo,
  type DemoFileIoController
} from '../../src/app/demo-file-io'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'me-demo-io-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  installWindowStub()
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

const DEMO_CONTENT = '# markdown_editor\n\ndemo 示例文档\n'

// window.api.fs 直连主进程实现；fs:changed 订阅收集回调供测试手动触发。
type FsChangedListener = (payload: unknown) => void
let fsChangedListeners: FsChangedListener[] = []

function installWindowStub(): void {
  fsChangedListeners = []
  const eventTarget = new EventTarget()
  const stub = {
    api: {
      fs: {
        readFile: readTextFile,
        stat: statFile,
        pathExists,
        writeFile: writeTextFile,
        deletePath,
        onFsChanged: (callback: FsChangedListener) => {
          fsChangedListeners.push(callback)
          return () => {
            fsChangedListeners = fsChangedListeners.filter((listener) => listener !== callback)
          }
        }
      },
      runtime: {
        call: async () => {
          throw new Error('[demo-file-io.test] runtime call 不可用')
        }
      }
    },
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis)
  }
  ;(globalThis as Record<string, unknown>)['window'] = stub
}

function emitFsChanged(payload: unknown): void {
  for (const listener of fsChangedListeners) {
    listener(payload)
  }
}

function makeStore(): ReturnType<typeof createEditorStore> {
  const store = createEditorStore()
  installDemoWorkspaceState(store, root)
  return store
}

async function pollUntil(predicate: () => boolean | Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await predicate()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`等待超时：${what}`)
}

const welcomePath = (): string => join(root, 'welcome.md')

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase()
}

describe('I-009 A1 打开真实文件', () => {
  it('启动即创建缺失的 welcome.md；已存在时编辑器内容与磁盘一致', async () => {
    const store = makeStore()
    // 不存在：创建示例文档。
    let controller = await startDemoFileIo({
      store,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: () => {}
    })
    expect(await pathExists({ filePath: welcomePath() })).toBe(true)
    const created = await readFile(welcomePath(), 'utf-8')
    expect(created).toBe(DEMO_CONTENT)
    controller.dispose()

    // 已存在：内容与磁盘一致 + 基线签名已记。
    await writeFile(welcomePath(), '# 磁盘已有内容\n', 'utf-8')
    controller = await startDemoFileIo({
      store,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: () => {}
    })
    const file = store.getState().openFiles[0]
    expect(file).toBeDefined()
    expect(normalizePath(file.filePath)).toBe(normalizePath(welcomePath()))
    expect(file.lastKnownDiskSignature).toBe(getDiskBaselineSignature('# 磁盘已有内容\n'))
    expect(store.getState().editorDrafts[file.id]).toBeUndefined()
    controller.dispose()
  })
})

describe('I-009 A2 保存写盘', () => {
  it('编辑草稿 + 手动保存后磁盘内容更新', async () => {
    const store = makeStore()
    const controller = await startDemoFileIo({
      store,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: () => {}
    })
    const fileId = controller.fileId
    store.getState().setEditorDraft(fileId, '# 编辑后的标题\n')
    store.getState().markFileDirty(fileId, true)

    await controller.saveNow()

    const onDisk = await readFile(welcomePath(), 'utf-8')
    expect(onDisk.startsWith('# 编辑后的标题')).toBe(true)
    expect(onDisk).not.toBe(DEMO_CONTENT)
    controller.dispose()
  })
})

describe('I-009 A3 自动保存生效', () => {
  it('编辑后防抖窗口内自动写盘', async () => {
    const store = makeStore()
    const controller = await startDemoFileIo({
      store,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: () => {}
    })
    store.getState().setEditorDraft(controller.fileId, '# 自动保存\n')
    store.getState().markFileDirty(controller.fileId, true)

    await pollUntil(async () => {
      const onDisk = await readFile(welcomePath(), 'utf-8')
      return onDisk.startsWith('# 自动保存')
    }, 'autosave 写盘')
    controller.dispose()
  })
})

describe('I-009 A4 外部修改可见', () => {
  it('dirty 时标记外部修改且不覆盖编辑缓冲；clean 时跟随磁盘重载', async () => {
    const store = makeStore()
    const reloaded: string[] = []
    const controller = await startDemoFileIo({
      store,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: (content) => reloaded.push(content)
    })
    const filePath = controller.fileId

    // dirty 分支：外部改 + 事件 → externalMutation='changed'，草稿保留。
    store.getState().setEditorDraft(filePath, '# 我的未保存编辑\n')
    store.getState().markFileDirty(filePath, true)
    await writeFile(welcomePath(), '# 外部改动\n', 'utf-8')
    emitFsChanged({
      worktreePath: root,
      events: [{ kind: 'update', absolutePath: welcomePath(), isDirectory: false }]
    })
    const file = store.getState().openFiles[0]
    expect(file.externalMutation).toBe('changed')
    expect(store.getState().editorDrafts[filePath]).toBe('# 我的未保存编辑\n')

    // 自写回声不触发：recordSelfWrite 后同路径事件被忽略（clean 分支也不重载）。
    const { recordSelfWrite } = await import(
      '../../src/components/editor/external-changes/editor-self-write-registry'
    )
    recordSelfWrite(filePath, 'self-written')
    reloaded.length = 0
    emitFsChanged({
      worktreePath: root,
      events: [{ kind: 'update', absolutePath: welcomePath(), isDirectory: false }]
    })
    expect(reloaded.length).toBe(0)
    const { clearSelfWrite } = await import(
      '../../src/components/editor/external-changes/editor-self-write-registry'
    )
    clearSelfWrite(filePath)

    // clean 分支：先走 keep 语义恢复（清标记 + 保留草稿），再清草稿模拟已保存；
    // 之后外部改 → 跟随磁盘重载。
    controller.dispose()
    const store2 = makeStore()
    const reloaded2: string[] = []
    const controller2 = await startDemoFileIo({
      store: store2,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: (content) => reloaded2.push(content)
    })
    emitFsChanged({
      worktreePath: root,
      events: [{ kind: 'update', absolutePath: welcomePath(), isDirectory: false }]
    })
    await pollUntil(() => reloaded2.length > 0, 'clean 跟随磁盘重载')
    expect(reloaded2[0]).toBe('# 外部改动\n')
    expect(store2.getState().openFiles[0].lastKnownDiskSignature).toBe(
      getDiskBaselineSignature('# 外部改动\n')
    )
    controller2.dispose()
  })
})

describe('I-009 A5 CAS 冲突不覆盖', () => {
  it('基线过期时保存被拒：磁盘保留外部版本，状态标记外部修改', async () => {
    const store = makeStore()
    const controller = await startDemoFileIo({
      store,
      workDir: root,
      demoContent: DEMO_CONTENT,
      onExternalReload: () => {}
    })
    store.getState().setEditorDraft(controller.fileId, '# 编辑器里的新版本\n')
    store.getState().markFileDirty(controller.fileId, true)
    // 外部改写但不发事件：编辑器基线过期（正是 CAS 要挡的场景）。
    await writeFile(welcomePath(), '# 外部的宝贵改动\n', 'utf-8')

    await expect(controller.saveNow()).rejects.toThrow()

    // 外部改动未被覆盖；保存队列标记 externalMutation。
    expect(await readFile(welcomePath(), 'utf-8')).toBe('# 外部的宝贵改动\n')
    await pollUntil(
      () => store.getState().openFiles[0]?.externalMutation === 'changed',
      'externalMutation 标记'
    )
    controller.dispose()
  })
})
