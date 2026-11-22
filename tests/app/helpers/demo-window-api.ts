// 探针共用 window.api stub：fs 直连主进程本地实现（真实读写 + 临时目录），
// runtime.call 走 envelope 包装；dialog 由测试注入（chosenDirectory 供应商）。
// 只挂 api 到既有 window（重建 window 会断裂 happy-dom 的 document 关联）。
import { callLocalRuntimeMethod } from '../../../electron/main/runtime-call'
import { exportDocument } from '../../../electron/main/export'
import {
  addRuntimeWorkRoot,
  importExternalPaths,
  listMarkdownDocuments,
  localWorkRoots,
  pathExists,
  readTextFile,
  statFile,
  writeTextFile
} from '../../../electron/main/files'

export type FsChangedListener = (payload: unknown) => void

let fsChangedListeners: FsChangedListener[] = []

export function resetFsChangedListeners(): void {
  fsChangedListeners = []
}

/** 测试手动派发 fs:changed（与 preload onFsChanged 订阅同形）。 */
export function emitFsChanged(
  worktreePath: string,
  events: Array<{ kind: string; absolutePath: string }>
): void {
  for (const listener of fsChangedListeners) {
    listener({
      worktreePath,
      events: events.map((event) => ({ ...event, isDirectory: false }))
    })
  }
}

/** 安装 window.api；chooseWorkDir / chooseExportPath 由 deps 提供（缺省取消）。 */
export function installDemoWindowApi(deps?: {
  chooseWorkDir?: () => { workDir: string | null; canceled: boolean }
  chooseExportPath?: (args: {
    title: string
    defaultFileName: string
    filters: Array<{ name: string; extensions: string[] }>
  }) => { filePath: string | null; canceled: boolean }
}): void {
  const win = (globalThis as unknown as { window: Record<string, unknown> }).window
  win['api'] = {
    runtime: {
      call: async (args: { method: string; params?: unknown }) => {
        try {
          return {
            ok: true,
            id: '',
            result: await callLocalRuntimeMethod(args.method, args.params)
          }
        } catch (error) {
          return {
            ok: false,
            id: '',
            error: {
              code: 'local_error',
              message: error instanceof Error ? error.message : String(error)
            }
          }
        }
      }
    },
    fs: {
      readFile: readTextFile,
      stat: statFile,
      pathExists,
      writeFile: writeTextFile,
      importExternalPaths,
      listMarkdownDocuments,
      watchWorktree: async () => undefined,
      unwatchWorktree: async () => undefined,
      onFsChanged: (callback: FsChangedListener) => {
        fsChangedListeners.push(callback)
        return () => {
          fsChangedListeners = fsChangedListeners.filter((listener) => listener !== callback)
        }
      }
    },
    app: {
      getWorkDir: async () => ({ workDir: localWorkRoots()[0] }),
      registerRuntimeWorktreeRoots: async (args: { worktreeId: string; rootPath: string }) => {
        addRuntimeWorkRoot(args.rootPath)
        return { ok: true }
      },
      chooseWorkDir: async () =>
        deps?.chooseWorkDir
          ? deps.chooseWorkDir()
          : { workDir: null, canceled: true },
      chooseExportPath: async (args: {
        title: string
        defaultFileName: string
        filters: Array<{ name: string; extensions: string[] }>
      }) =>
        deps?.chooseExportPath
          ? deps.chooseExportPath(args)
          : { filePath: null, canceled: true },
      exportDocument: async (args: { kind: 'html' | 'pdf'; filePath: string; html: string }) =>
        await exportDocument(args)
    }
  }
}
