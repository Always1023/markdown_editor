// 精简版应用 store。与 Orca 原版（60+ 切片 + 诊断探针 + runtime 状态绑定）的差异：
// 只组合 tabs 与 editor 两条真实切片 + 被裁切片的兼容空态；保留编辑器缓冲记录
// 生命周期中间件（withEditorBufferRecords）—— 三方 reconcile 的核心写路径。
import { create, type StateCreator } from 'zustand'
import type { AppState } from './types'
import { createEditorSlice } from './slices/editor/create-editor-slice'
import { createTabsSlice } from './slices/tabs/create-tabs-slice'
import { createDiffCommentsSlice } from './slices/diff-comments/create-diff-comments-slice'
import { createCompatState } from './compat/create-compat-state'
import { withEditorBufferRecords } from './slices/editor/buffers/editor-buffer-record-lifecycle'
import { attachEditorBufferIdentityEvents } from './slices/editor/buffers/editor-buffer-identity-events'
import { registerStructuredSelectionCatalogStore } from '@/lib/agent-session/options/structured-agent-session-selection-controller'
import {
  registerHttpLinkStoreAccessor,
  registerHttpLinkGroupActionAvailability
} from '@/lib/browser/navigation/http-link-routing'
import { registerAppHttpLinkStateAccessor } from '@/lib/browser/navigation/app-http-link-open'
import { canOfferHttpLinkGroupAction } from '@/lib/browser/navigation/http-link-in-group-availability'

const createState: StateCreator<AppState, [], []> = (...a) => ({
  ...createCompatState(...(a as Parameters<typeof createCompatState>)),
  ...createTabsSlice(...(a as Parameters<typeof createTabsSlice>)),
  ...createEditorSlice(...(a as Parameters<typeof createEditorSlice>)),
  ...createDiffCommentsSlice(...(a as Parameters<typeof createDiffCommentsSlice>))
})

export const useAppStore = create<AppState>()(withEditorBufferRecords(createState))

attachEditorBufferIdentityEvents(() => useAppStore.getState())

registerStructuredSelectionCatalogStore({
  read: useAppStore.getState,
  subscribe: useAppStore.subscribe
})
registerHttpLinkStoreAccessor(() => useAppStore.getState(), useAppStore.subscribe)
registerHttpLinkGroupActionAvailability((request) =>
  canOfferHttpLinkGroupAction(useAppStore.getState(), request)
)
registerAppHttpLinkStateAccessor(() => useAppStore.getState())
