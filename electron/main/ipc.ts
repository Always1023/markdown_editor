// IPC 注册：把 window.api.fs.* / window.api.runtime.call / worktrees:register 三条
// 渲染端通道接到本地实现。通道名与 Orca 的 ipc/filesystem 对齐（fs:readFile 等）。
import { ipcMain, shell } from 'electron'
import {
  copyPath,
  createDirectory,
  createFile,
  deletePath,
  importExternalPaths,
  listMarkdownDocuments,
  pathExists,
  readFileChunk,
  readDirEntries,
  readTextFile,
  renamePath,
  statFile,
  writeFileBytes,
  writeTextFile
} from './files'
import { callLocalRuntimeMethod } from './runtime-call'
import { registerRuntimeWorktreeRoots } from './worktree-roots'
import { subscribeLocalWatcher, unsubscribeLocalWatcher } from './fs-watch'
import { localWorkRoots } from './files'

/** 逐个 handler 包一层错误投影：非 Error 的拒绝统一转成带通道名的 Error。 */
function handleSafe(
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, payload: unknown) => Promise<unknown>
): void {
  ipcMain.handle(channel, async (event, payload: unknown) => {
    try {
      return await fn(event, payload)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`[${channel}] ${String(error)}`)
    }
  })
}

export function registerLocalIpcHandlers(): void {
  handleSafe('fs:readFile', (_event, p) => readTextFile(p as { filePath: string }))
  handleSafe('fs:stat', (_event, p) => statFile(p as { filePath: string }))
  handleSafe('fs:pathExists', (_event, p) => pathExists(p as { filePath: string }))
  handleSafe('fs:readDir', (_event, p) => readDirEntries(p as { dirPath: string }))
  handleSafe('fs:readFileChunk', (_event, p) =>
    readFileChunk(p as { filePath: string; offset: number; length: number })
  )
  handleSafe('fs:writeFile', (_event, p) => writeTextFile(p as { filePath: string; content: string }))
  handleSafe('fs:writeFileBytes', (_event, p) =>
    writeFileBytes(
      p as {
        filePath: string
        bytes: Uint8Array
        diskPrecondition: { expectedSignature: string; allowMissing?: boolean }
      }
    )
  )
  handleSafe('fs:createFile', (_event, p) => createFile(p as { filePath: string }))
  handleSafe('fs:createDir', (_event, p) => createDirectory(p as { dirPath: string }))
  handleSafe('fs:rename', (_event, p) => renamePath(p as { oldPath: string; newPath: string }))
  handleSafe('fs:copy', (_event, p) => copyPath(p as { sourcePath: string; destinationPath: string }))
  handleSafe('fs:deletePath', (_event, p) => deletePath(p as { targetPath: string; permanent?: boolean }))
  handleSafe('fs:listMarkdownDocuments', (_event, p) =>
    listMarkdownDocuments(p as { rootPath: string })
  )
  handleSafe('fs:importExternalPaths', (_event, p) =>
    importExternalPaths(p as { sourcePaths: string[]; destDir: string })
  )
  // 文件 watch（I-008）：按窗口订阅；payload 形状与 Orca fs:changed 一致。
  handleSafe('fs:watchWorktree', async (event, p) => {
    const args = p as { worktreePath: string }
    await subscribeLocalWatcher(args.worktreePath, event.sender)
    return { ok: true }
  })
  handleSafe('fs:unwatchWorktree', async (event, p) => {
    const args = p as { worktreePath: string }
    unsubscribeLocalWatcher(args.worktreePath, event.sender.id)
    return { ok: true }
  })
  // 渲染端选择「在外部查看」类动作：交给系统 shell（本地形态无远端主机）。
  handleSafe('fs:showInFolder', async (_event, p) => {
    shell.showItemInFolder(String((p as { path: string })['path']))
    return { ok: true }
  })

  handleSafe('runtime:call', async (_event, p) => {
    const args = p as { method: string; params?: unknown }
    // 渲染端 callRuntimeRpc 期待 envelope（RuntimeRpcResponse）：成功包 result，失败包 error。
    try {
      const result = await callLocalRuntimeMethod(args.method, args.params)
      return { ok: true, id: '', result }
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
  })

  // 渲染端装配 demo 文件 IO 时读取工作根（I-009：单文件闭环的落盘目录）。
  handleSafe('fs:getWorkDir', async () => {
    const roots = localWorkRoots()
    return { workDir: roots[0] ?? process.cwd() }
  })

  handleSafe('worktrees:register', async (_event, p) => {
    const args = p as { worktreeId: string; rootPath: string }
    registerRuntimeWorktreeRoots({ worktreeId: args.worktreeId, rootPath: args.rootPath })
    return { ok: true }
  })
}
