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

/** 逐个 handler 包一层错误投影：非 Error 的拒绝统一转成带通道名的 Error。 */
function handleSafe(channel: string, fn: (payload: unknown) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, payload: unknown) => {
    try {
      return await fn(payload)
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`[${channel}] ${String(error)}`)
    }
  })
}

export function registerLocalIpcHandlers(): void {
  handleSafe('fs:readFile', (p) => readTextFile(p as { filePath: string }))
  handleSafe('fs:stat', (p) => statFile(p as { filePath: string }))
  handleSafe('fs:pathExists', (p) => pathExists(p as { filePath: string }))
  handleSafe('fs:readDir', (p) => readDirEntries(p as { dirPath: string }))
  handleSafe('fs:readFileChunk', (p) =>
    readFileChunk(p as { filePath: string; offset: number; length: number })
  )
  handleSafe('fs:writeFile', (p) => writeTextFile(p as { filePath: string; content: string }))
  handleSafe('fs:writeFileBytes', (p) =>
    writeFileBytes(
      p as {
        filePath: string
        bytes: Uint8Array
        diskPrecondition: { expectedSignature: string; allowMissing?: boolean }
      }
    )
  )
  handleSafe('fs:createFile', (p) => createFile(p as { filePath: string }))
  handleSafe('fs:createDir', (p) => createDirectory(p as { dirPath: string }))
  handleSafe('fs:rename', (p) => renamePath(p as { oldPath: string; newPath: string }))
  handleSafe('fs:copy', (p) => copyPath(p as { sourcePath: string; destinationPath: string }))
  handleSafe('fs:deletePath', (p) => deletePath(p as { targetPath: string; permanent?: boolean }))
  handleSafe('fs:listMarkdownDocuments', (p) =>
    listMarkdownDocuments(p as { rootPath: string })
  )
  handleSafe('fs:importExternalPaths', (p) =>
    importExternalPaths(p as { sourcePaths: string[]; destDir: string })
  )
  // 渲染端选择「在外部查看」类动作：交给系统 shell（本地形态无远端主机）。
  handleSafe('fs:showInFolder', async (p) => {
    shell.showItemInFolder(String((p as { path: string })['path']))
    return { ok: true }
  })

  handleSafe('runtime:call', async (p) => {
    const args = p as { method: string; params?: unknown }
    return callLocalRuntimeMethod(args.method, args.params)
  })

  handleSafe('worktrees:register', async (p) => {
    const args = p as { worktreeId: string; rootPath: string }
    registerRuntimeWorktreeRoots({ worktreeId: args.worktreeId, rootPath: args.rootPath })
    return { ok: true }
  })
}
