// window.api 的真实桥（I-007）：fs 子集 / runtime.call / worktrees:register。
// 类型面以 src/preload/api-types.ts 为唯一真源；此处只 expose 渲染端实际触达的
// 通道，未接线的成员在渲染端触达时抛错（失败可见）。
import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, payload?: unknown): Promise<unknown> =>
  ipcRenderer.invoke(channel, payload)

const api = {
  fs: {
    readFile: (args: unknown) => invoke('fs:readFile', args),
    readFileChunk: (args: unknown) => invoke('fs:readFileChunk', args),
    readDir: (args: unknown) => invoke('fs:readDir', args),
    writeFile: (args: unknown) => invoke('fs:writeFile', args),
    writeFileBytes: (args: unknown) => invoke('fs:writeFileBytes', args),
    createFile: (args: unknown) => invoke('fs:createFile', args),
    createDir: (args: unknown) => invoke('fs:createDir', args),
    rename: (args: unknown) => invoke('fs:rename', args),
    copy: (args: unknown) => invoke('fs:copy', args),
    deletePath: (args: unknown) => invoke('fs:deletePath', args),
    stat: (args: unknown) => invoke('fs:stat', args),
    pathExists: (args: unknown) => invoke('fs:pathExists', args),
    listMarkdownDocuments: (args: unknown) => invoke('fs:listMarkdownDocuments', args),
    importExternalPaths: (args: unknown) => invoke('fs:importExternalPaths', args),
    watchWorktree: (args: unknown) => invoke('fs:watchWorktree', args),
    unwatchWorktree: (args: unknown) => invoke('fs:unwatchWorktree', args),
    onFsChanged: (callback: (payload: unknown) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) =>
        callback(payload)
      ipcRenderer.on('fs:changed', listener)
      return () => ipcRenderer.removeListener('fs:changed', listener)
    }
  },
  runtime: {
    call: (args: { method: string; params?: unknown }) => invoke('runtime:call', args)
  },
  app: {
    registerRuntimeWorktreeRoots: (args: unknown) => invoke('worktrees:register', args),
    getWorkDir: () => invoke('fs:getWorkDir')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
