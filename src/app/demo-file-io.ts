// I-009 demo 文件 IO 组装：把已迁移的保存链（editorDrafts + save queue + autosave
// controller + self-write registry + 外部修改标记）接到真实磁盘上的单个文件。
// 直写仅限新建（AC-04）：welcome.md 缺失时用无基线直写创建，此后全部更新走
// writeIfUnchanged CAS。阶段 3 外壳（文件树 / 多标签）替换这个装配点。
import type { AppStoreApi } from '@/components/editor/save/queue/editor-save-queue-contract'
import { attachEditorAutosaveController } from '@/components/editor/autosave/editor-autosave-controller'
import { requestEditorFileSave } from '@/components/editor/autosave/editor-autosave'
import { markFileChangedOnDisk } from '@/components/editor/external-changes/editor-changed-on-disk-mark'
import { hasRecentSelfWrite } from '@/components/editor/external-changes/editor-self-write-registry'
import { getDiskBaselineSignature } from '@/shared/file-write/disk-baseline-signature'
import type { FsChangedPayload } from '@/shared/file-watch/filesystem-change-event'
import type { AppState } from '@/store/types'

// demo 工作区：编辑器的 owner / route 派生按 worktreesByRepo 解析；path 指向磁盘工作目录。
export const DEMO_WORKTREE_ID = 'demo::local'

/** 注册 demo 工作区与自动保存设置（App 启动 / 测试装配共用）。 */
export function installDemoWorkspaceState(store: AppStoreApi, workDir: string): void {
  // 最小工作区桩：Repo / Worktree 全形状属阶段 3 外壳，这里只填派生 owner 用到的字段。
  store.setState((state) => ({
    activeWorktreeId: DEMO_WORKTREE_ID,
    repos: [{ id: 'demo', path: workDir, kind: 'git', executionHostId: 'local' }],
    worktreesByRepo: {
      demo: [{ id: DEMO_WORKTREE_ID, repoId: 'demo', path: workDir, hostId: 'local', branch: '' }]
    },
    settings: {
      ...state.settings,
      editorAutoSave: true,
      editorAutoSaveDelayMs: 300
    }
  }) as unknown as Partial<AppState>)
}

/** 换根（I-011「打开文件夹」）：只更新工作区路径，不动用户的自动保存设置。 */
export function updateDemoWorkspaceRoot(store: AppStoreApi, workDir: string): void {
  store.setState((state) => ({
    repos: [{ id: 'demo', path: workDir, kind: 'git', executionHostId: 'local' }],
    worktreesByRepo: {
      demo: [{ id: DEMO_WORKTREE_ID, repoId: 'demo', path: workDir, hostId: 'local', branch: '' }]
    }
  }) as unknown as Partial<AppState>)
}

function joinWorkDirPath(workDir: string, fileName: string): string {
  return `${workDir.replace(/[\\/]+$/, '')}/${fileName}`
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()
}

/** filePath 相对 workDir 的展示路径（统一正斜杠；不在 workDir 下时回退文件名）。 */
function relativeToWorkDir(workDir: string, filePath: string): string {
  const normalizedWork = workDir.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  const normalizedFile = filePath.replace(/\\/g, '/')
  if (normalizedFile.toLowerCase().startsWith(normalizedWork.toLowerCase() + '/')) {
    return normalizedFile.slice(normalizedWork.length + 1)
  }
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
}

export type WorkspaceFileOptions = {
  store: AppStoreApi
  /** 真实工作目录（主进程工作根之内——env 声明或「打开文件夹」注册的根）。 */
  workDir: string
  /** 要打开的文件绝对路径。 */
  filePath: string
  /** clean 跟随磁盘重载后的新内容（编辑器用它刷新缓冲）。 */
  onExternalReload: (content: string) => void
}

export type WorkspaceFileController = {
  fileId: string
  filePath: string
  /** 打开时的磁盘内容（后续以 onExternalReload 通知更新）。 */
  content: string
  dispose(): void
  /** Ctrl+S / 手动保存：走 save queue（CAS 基线过期会被拒）。 */
  saveNow(): Promise<void>
}

// I-011：文件树「打开文件」装配点——登记 OpenFile、盖磁盘基线、按文件订阅 fs:changed
// （自写回声过滤 / dirty 标外部修改 / clean 跟随重载，语义与 I-009 单文件版一致）。
export async function openWorkspaceFile(
  options: WorkspaceFileOptions
): Promise<WorkspaceFileController> {
  const { store, filePath } = options
  const bridge = window.api
  if (!bridge?.fs?.readFile || !bridge.fs.writeFile || !bridge.fs.onFsChanged) {
    throw new Error('[demo-file-io] window.api.fs 文件通道不可用（缺 preload 桥）')
  }
  const fs = bridge.fs

  const loaded = await fs.readFile({ filePath })
  if (loaded.isBinary) {
    throw new Error(`[demo-file-io] 目标文件不是 UTF-8 文本：${filePath}`)
  }
  const content = loaded.content

  store.getState().openFile({
    filePath,
    relativePath: relativeToWorkDir(options.workDir, filePath),
    worktreeId: DEMO_WORKTREE_ID,
    language: 'markdown',
    mode: 'edit'
  })
  const file = store.getState().openFiles.find((candidate) => candidate.filePath === filePath)
  if (!file) {
    throw new Error(`[demo-file-io] openFile 未登记目标文件：${filePath}`)
  }
  const fileId = file.id
  // 保存前置基线：磁盘当前版本签名（editorSavePrecondition 的 guarded 输入）。
  store.getState().setLastKnownDiskSignature(fileId, getDiskBaselineSignature(content))

  let currentDiskContent = content

  const refreshFromDisk = async (): Promise<void> => {
    const latest = await fs.readFile({ filePath })
    if (latest.isBinary) {
      return
    }
    currentDiskContent = latest.content
    options.onExternalReload(latest.content)
    store
      .getState()
      .setLastKnownDiskSignature(fileId, getDiskBaselineSignature(latest.content))
  }

  const unsubscribeFs = fs.onFsChanged((payload: FsChangedPayload) => {
    const touched =
      payload.events.some(
        (event) => event.kind === 'overflow' || samePath(event.absolutePath, filePath)
      ) ?? false
    if (!touched) {
      return
    }
    const state = store.getState()
    const liveFile = state.openFiles.find((candidate) => candidate.id === fileId)
    if (!liveFile) {
      return
    }
    // 自己刚写盘的回声（save queue 已记录 self-write）不算外部修改。
    if (hasRecentSelfWrite(liveFile.filePath, liveFile.runtimeEnvironmentId)) {
      return
    }
    if (liveFile.isDirty) {
      // 有未保存编辑：标记外部修改（横幅），绝不静默覆盖缓冲。
      markFileChangedOnDisk(state, liveFile, { connectionId: undefined, origin: 'live' })
      return
    }
    void refreshFromDisk()
  })

  return {
    fileId,
    filePath,
    content,
    dispose: () => {
      unsubscribeFs()
    },
    saveNow: async () => {
      const draft = store.getState().editorDrafts[fileId] ?? currentDiskContent
      await requestEditorFileSave({ fileId, fallbackContent: draft })
    }
  }
}

export type DemoFileIoOptions = {
  store: AppStoreApi
  /** 真实工作目录（主进程 MARKDOWN_EDITOR_ROOTS 声明的根之内）。 */
  workDir: string
  /** 默认 welcome.md。 */
  fileName?: string
  /** 目录里没有目标文件时创建的示例内容。 */
  demoContent: string
  /** clean 跟随磁盘重载后的新内容（编辑器用它刷新缓冲）。 */
  onExternalReload: (content: string) => void
}

export type DemoFileIoController = WorkspaceFileController

export async function startDemoFileIo(options: DemoFileIoOptions): Promise<DemoFileIoController> {
  const { store } = options
  const fileName = options.fileName ?? 'welcome.md'
  const filePath = joinWorkDirPath(options.workDir, fileName)
  const bridge = window.api
  if (!bridge?.fs?.readFile || !bridge.fs.writeFile || !bridge.fs.onFsChanged) {
    throw new Error('[demo-file-io] window.api.fs 文件通道不可用（缺 preload 桥）')
  }

  // 缺失即创建（直写仅限新建）；此后一切更新都走保存队列的 CAS。
  if (!(await bridge.fs.pathExists({ filePath }))) {
    await bridge.fs.writeFile({ filePath, content: options.demoContent })
  }

  const controller = await openWorkspaceFile({
    store,
    workDir: options.workDir,
    filePath,
    onExternalReload: options.onExternalReload
  })

  // 自动保存控制器全局只挂一份（多文件共用同一个 save queue）；随首个文件生命周期开停。
  const detachAutosave = attachEditorAutosaveController(store)

  return {
    ...controller,
    dispose: () => {
      controller.dispose()
      detachAutosave()
    }
  }
}
