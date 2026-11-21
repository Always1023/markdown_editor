// 精简版 AppState：编辑器切片 + 标签页切片 + diff 批注切片 + 被裁切片的兼容状态面。
// Orca 原版是 60+ 切片的大联合（store/types.ts）；本地单机 Markdown 编辑器只保留
// editor / tabs / diff-comments 三条真实切片，其余字段进 CompatState（见 compat/compat-state.ts）。
import type { EditorSlice } from './slices/editor/types/editor-slice'
import type { TabsSlice } from './slices/tabs/tabs-slice-contract'
import type { DiffCommentsSlice } from './slices/diff-comments/create-diff-comments-slice'
import type { CompatState } from './compat/compat-state'

export type AppState = EditorSlice & TabsSlice & DiffCommentsSlice & CompatState
