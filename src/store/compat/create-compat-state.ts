// 兼容状态切片：被裁切片的空实现。读恒为空值；动作要么本地合并（settings），
// 要么空操作。带行为的只有 settings / setTabBarOrder —— demo 与外壳需要真实写。
import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { CompatState } from './compat-state'
import type { FeatureInteractionId } from '@/shared/feature-education/interactions/feature-interaction-catalog'
import {
  isWorkspaceKey,
  worktreeWorkspaceKey
} from '@/shared/workspace/identity/workspace-scope'
import { toVisibleTabType } from '@/shared/workspace-layout/tab-groups/tab-types'
import { persistAppSettings } from '@/app/settings-persistence'

// 纯数据字段；带 set 的动作在下方 creator 里实现，避免字段对象脱离 creator 作用域。
const compatFields = {
  repos: [],
  projectGroups: [],
  activeRepoId: null,
  activeWorkspaceKey: null,
  ptyIdsByTabId: {},
  localOnlyScrollbackByTabId: {},
  lastKnownRelayPtyIdByTabId: {},
  lastVisitedAtByWorktreeId: {},
  defaultTerminalTabsAppliedByWorktreeId: {},
  worktreesByRepo: {},
  activeWorktreeId: null,
  activeWorkspaceExecutionHostId: null,
  folderWorkspaces: [],
  runtimeEnvironments: [],
  detectedWorktreesByRepo: {},
  restoredRuntimeHostIdByWorkspaceSessionKey: {},
  runtimeEnvironmentCatalogHydrated: false,
  removedRuntimeEnvironmentIds: new Set<string>(),
  recentlyClosedTabKindsByWorktree: {},
  recentQuickCommandIdByGroup: {},
  reopenClosedTerminalTab: () => false,
  reopenClosedBrowserTab: () => null,
  createBrowserTab: () => {
    // 本地形态没有内嵌浏览器；建页签属于契约要求的能力，触达即失败可见。
    throw new Error('[browser] 内嵌浏览器未包含在本产品中')
  },
  activeView: 'terminal',
  activeModal: 'none',
  modalData: {},
  activeTabType: 'terminal',
  activeTabTypeByWorktree: {},
  activeOrcaProfileId: null,
  browserSessionProfilesByHostId: {},
  browserSessionProfiles: [],
  browserSessionHostIdOverride: null,
  ensureManagedBrowserSessionProfile: (_owner, _label) => ({ sessionProfileId: null }),
  remoteBrowserPageHandlesByPageId: {},
  runtimeStatusByEnvironmentId: new Map(),
  floatingWorkspacePath: null,
  tabsByWorktree: {},
  activeTabId: null,
  activeTabIdByWorktree: {},
  tabBarOrderByWorktree: {},
  browserTabsByWorktree: {},
  activeBrowserTabId: null,
  activeBrowserTabIdByWorktree: {},
  browserPagesByWorkspace: {},
  browserAnnotationsByPageId: {},
  browserUrlHistory: [],
  workspaceDocHistory: [],
  browserCertificateFailuresByPageId: {},
  terminalLayoutsByTabId: {},
  runtimePaneTitlesByTabId: {},
  pendingReconnectPtyIdByTabId: {},
  deferredSshSessionIdsByTabId: {},
  nativeChatLaunchDraftByTabId: {},
  workspaceSessionReady: false,
  hydrationSucceeded: false,
  sleepingAgentSessionsByPaneKey: {},
  sshConnectionStates: new Map(),
  sshStateByEnvironment: new Map(),
  settings: null,
  editorFontZoomLevel: 0,
  keybindings: {},
  agentStatusByPaneKey: new Map()
} as Omit<
  CompatState,
  | 'setActiveWorktree'
  | 'getKnownWorktreeById'
  | 'setTabBarOrder'
  | 'setActiveView'
  | 'updateSettings'
  | 'setEditorFontZoomLevel'
  | 'recordFeatureInteraction'
  | 'openModal'
  | 'closeModal'
>

export const createCompatState: StateCreator<AppState, [], [], CompatState> = (set, get) => ({
  ...compatFields,
  // 本地单机只有一个工作区，但激活语义不是空操作：调用方（编辑器 reparent、页签放置）
  // 传入的 stateTransition 携带本次切换要落盘的 patch（如跨工作区移动编辑器页签），
  // 必须求值并合并，否则调用方拿不到迁移结果。激活面（activeFileId / activeTabType）
  // 按派生器从合并后的状态取——与 Orca set-active-worktree.ts 的本地相关子集一致；
  // 终端唤醒、PTY 预热、GitHub 刷新等远端面不迁移。
  setActiveWorktree: (worktreeId, executionHostId, options) => {
    const stateTransition = options?.stateTransition?.(get())
    if (stateTransition && !stateTransition.activate) {
      if (Object.keys(stateTransition.patch).length > 0) {
        set(stateTransition.patch)
      }
      return false
    }
    set((current): Partial<AppState> => {
      const transitioned = stateTransition ? { ...current, ...stateTransition.patch } : current
      if (!worktreeId) {
        return {
          ...stateTransition?.patch,
          activeWorktreeId: null,
          activeWorkspaceKey: null,
          activeWorkspaceExecutionHostId: null
        }
      }
      // 激活面推导（deriveActiveSurfaceForWorktree 的本地编辑器子集）：优先取
      // preferredTabId 指定的页签，编辑器页签落 activeFileId；本地形态没有浏览器 /
      // 终端页签，浏览器与终端面恒 null / 'terminal'。
      const preferredTabId = stateTransition?.preferredActiveUnifiedTabId
      const unifiedTabs = transitioned.unifiedTabsByWorktree[worktreeId] ?? []
      const preferredTab = preferredTabId
        ? (unifiedTabs.find((tab) => tab.id === preferredTabId) ?? null)
        : null
      const restoredFileId = transitioned.activeFileIdByWorktree[worktreeId] ?? null
      const fileStillOpen = restoredFileId
        ? unifiedTabs.some((tab) => tab.entityId === restoredFileId)
        : false
      const activeFileId = preferredTab
        ? preferredTab.contentType === 'editor'
          ? preferredTab.entityId
          : fileStillOpen
            ? restoredFileId
            : null
        : fileStillOpen
          ? restoredFileId
          : null
      const activeTabType = preferredTab ? toVisibleTabType(preferredTab.contentType) : 'terminal'
      return {
        ...stateTransition?.patch,
        activeWorkspaceKey: isWorkspaceKey(worktreeId) ? worktreeId : worktreeWorkspaceKey(worktreeId),
        activeWorktreeId: worktreeId,
        activeWorkspaceExecutionHostId: executionHostId ?? null,
        activeFileId,
        activeBrowserTabId: null,
        activeTabType,
        activeTabId: preferredTab?.id ?? null,
        activeTabTypeByWorktree:
          transitioned.activeTabTypeByWorktree[worktreeId] === activeTabType
            ? transitioned.activeTabTypeByWorktree
            : { ...transitioned.activeTabTypeByWorktree, [worktreeId]: activeTabType }
      }
    })
    return true
  },
  getKnownWorktreeById: (worktreeId, _executionHostId) => {
    const state = get()
    for (const worktrees of Object.values(state.worktreesByRepo)) {
      const hit = worktrees.find((entry) => entry.id === worktreeId)
      if (hit) {
        return hit
      }
    }
    for (const detected of Object.values(state.detectedWorktreesByRepo)) {
      const hit = detected.worktrees.find((entry) => entry.id === worktreeId)
      if (hit) {
        return hit
      }
    }
    return undefined
  },
  setTabBarOrder: (worktreeId, order) => {
    set((state) => ({
      tabBarOrderByWorktree: { ...state.tabBarOrderByWorktree, [worktreeId]: order }
    }))
  },
  setActiveView: (view) => {
    // activeView 恒为非空字符串（本地 'terminal' 空壳视图）；null 视为回默认。
    set({ activeView: view ?? 'terminal' })
  },
  // Orca ui-slice-modal-actions.ts 的本地子集：弹层开合真实写（图表放大查看等）；
  // 省略 feature-education 埋点与 modal-slot 驱逐回调（本地无运营面）。
  openModal: (modal, data = {}) => {
    set({ activeModal: modal, modalData: data })
  },
  closeModal: () => {
    set({ activeModal: 'none', modalData: {} })
  },
  // 设置持久化（I-016）：合并后落 localStorage；恢复在 App 启动时经 hydrateAppSettings。
  updateSettings: async (updates) => {
    set((state) => ({ settings: { ...state.settings, ...updates } as NonNullable<AppState['settings']> }))
    persistAppSettings(get().settings)
  },
  // Orca ui-slice-persistence-actions.ts 逐字本地子集：缩放会话内即时生效（不持久化）。
  setEditorFontZoomLevel: (level) => {
    set({ editorFontZoomLevel: level })
  },
  recordFeatureInteraction: async (_id: FeatureInteractionId) => {
    // 功能引导埋点属于 Orca 运营面，本地形态不采集。
  }
})
