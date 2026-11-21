// 桩（来源 Orca store/slices/runtime-status/create-runtime-status-slice.ts，291 行）。
// 运行时状态切片管理多主机状态目录（本地恒空）；唯一的本地引用方只需其副作用导入的
// 模块初始化顺序，无符号消费。保留同名导出以免后续接线漏改。
import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'

export type RuntimeStatusSliceStub = Record<string, never>

export const createRuntimeStatusSlice: StateCreator<AppState, [], [], RuntimeStatusSliceStub> =
  () => ({})
