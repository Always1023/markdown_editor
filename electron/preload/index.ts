import { contextBridge } from 'electron'

// I-005 会把这里补成与 Orca 同名的 window.api 全量桥；脚手架阶段先给最小占位。
const api = {
  __brand: 'markdown_editor-preload'
} as const

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
