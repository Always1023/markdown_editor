// 精简 store 的兼容类型面：这些字段属于 Orca 里被裁掉的切片（浏览器 / 终端 / SSH / 仓库），
// 但迁移来的编辑器、persistence 与 layout 代码在类型层仍引用它们。
// 运行时由 index.ts 初始化为空值；类型保持与 Orca 声明一致（来源见各行注释）。
import type { TerminalLayoutSnapshot, TerminalTab } from '@/shared/workspace-layout/terminal-tab-types'
import type {
  BrowserCertificateFailure,
  BrowserHistoryEntry,
  BrowserPage,
  BrowserSessionProfile,
  BrowserWorkspace
} from '@/shared/browser/workspaces/browser-workspace-types'
import type { BrowserPageAnnotation } from '@/shared/browser/element-grab/browser-grab-types'
import type { WorkspaceDocHistoryEntry } from '@/shared/workspace-session/workspace-doc-history'
import type { SshConnectionState } from '@/shared/remote-runtime/ssh/ssh-types'
import type { FolderWorkspace } from '@/shared/folder-workspaces/folder-workspace-types'
import type { Repo } from '@/shared/repository/repo-types'
import type {
  DetectedWorktree,
  DetectedWorktreeListResult,
  Worktree
} from '@/shared/worktree/types'
import type { WorkspaceKey } from '@/shared/workspace/identity/workspace-scope'
import type { AgentStatusEntry } from '@/shared/agent-status/contracts/agent-status-types'
import type { GlobalSettings } from '@/shared/settings/global-settings-types'
import type { ExecutionHostId } from '@/shared/execution-host/execution-host'
import type { SleepingAgentSessionRecord } from '@/shared/agent-session/lifecycle/agent-session-resume'
import type { NativeChatLaunchDraft } from '@/components/native-chat/drafts/native-chat-launch-prompt'
import type { FeatureInteractionId } from '@/shared/feature-education/interactions/feature-interaction-catalog'
import type { PublicKnownRuntimeEnvironment } from '@/shared/remote-runtime/host-catalog/runtime-environments'
import type { ProjectGroup } from '@/shared/project/groups/project-group-types'
import type { RuntimeEnvironmentStatus } from '@/shared/remote-runtime/host-status/runtime-host-status'
import type { AppState } from '../types'
// 句柄类型以 browser-slice-contract 的完整形状为准（含 staged / browserProfileId 等可选字段）。
import type { RemoteBrowserPageHandle } from '@/store/slices/browser/browser-slice-contract'
import type { RecentlyClosedTabKind } from '@/store/slices/tabs/recently-closed-tabs'
import type {
  CreateBrowserTabOptions,
  NewBrowserTabProfile
} from '@/store/slices/browser/browser-slice-contract'
import type { ManagedBrowserProfileOwner } from '@/shared/browser/profiles/browser-profile-scope'

/** Orca store/slices/ssh/runtime-environment-ssh.ts 的桶类型（本地形态照抄，未迁其实现）。 */
export type RuntimeEnvironmentSshBucket = {
  environmentId: string
  connectionStates: Map<string, SshConnectionState>
}

/**
 * 被裁切片留下的只读兼容状态。字段语义与 Orca 一致；值恒为空，读它们的行为在
 * 本地单机形态下本来就不会发生（浏览器 / 终端 / SSH 主机不存在）。
 */
export type CompatState = {
  // Orca store/repos/create-repo-slice.ts
  repos: Repo[]
  projectGroups: ProjectGroup[]
  activeRepoId: string | null
  // Orca store/slices/worktrees/worktree-slice-contract.ts
  worktreesByRepo: Record<string, Worktree[]>
  activeWorktreeId: string | null
  activeWorkspaceExecutionHostId: ExecutionHostId | null
  folderWorkspaces: FolderWorkspace[]
  // Orca store/slices/worktrees（会话层）；本地单机只有一个活动工作区。
  // options 形状对齐契约（stateTransition / createdTabIds），本地实现只记录 id。
  setActiveWorktree: (
    worktreeId: string | null,
    executionHostId?: ExecutionHostId,
    options?: {
      stateTransition?: (state: AppState) => {
        patch: Partial<AppState>
        activate: boolean
        preferredActiveUnifiedTabId?: string
      }
      createdTabIds?: readonly string[]
    }
  ) => boolean
  // Orca 契约签名：带 host 过滤，未命中返回 undefined（含 DetectedWorktree）。
  getKnownWorktreeById: (
    worktreeId: string,
    executionHostId?: ExecutionHostId
  ) => Worktree | DetectedWorktree | undefined
  // Orca store/slices/runtime-status/runtime-status-types.ts（多主机目录；本地恒空）
  runtimeEnvironments: readonly PublicKnownRuntimeEnvironment[]
  // Orca 的值是 DetectedWorktreeListResult（含 worktrees / authoritative）；
  // route / validity catalog 代码按这个形状读，不能摊平成数组。
  detectedWorktreesByRepo: Record<string, DetectedWorktreeListResult>
  restoredRuntimeHostIdByWorkspaceSessionKey: Record<string, ExecutionHostId>
  runtimeEnvironmentCatalogHydrated: boolean
  removedRuntimeEnvironmentIds: ReadonlySet<string>
  // Orca store/slices/tabs/recently-closed-tabs.ts（各类型标签的最近关闭记录）
  recentlyClosedTabKindsByWorktree: Record<string, RecentlyClosedTabKind[]>
  // 重开动作：终端 / 浏览器标签本地不存在，恒返回「无可重开」。
  reopenClosedTerminalTab: (worktreeId: string) => boolean
  reopenClosedBrowserTab: (worktreeId: string) => BrowserWorkspace | null
  // Orca store/terminals/terminal-state.ts（快捷命令分组记忆；本地恒空）
  recentQuickCommandIdByGroup: Record<string, string>
  // Orca slices/ui：activeView 为 TopLevelView 字面量并集（本地恒为 'terminal' 空壳视图，
  // 非 null——迁移件按非空字符串比较）；activeModal 为模态字面量并集（本地恒 'none'）。
  // modal 面（openModal / closeModal / modalData）保留真实写：图表放大等弹层走它。
  activeView: string
  activeModal: string | null
  modalData: Record<string, unknown>
  openModal: (modal: string, data?: Record<string, unknown>) => void
  closeModal: () => void
  // Orca store/slices/tabs/tabs-surface.ts：活动页签类型（本地恒 'terminal'）。
  activeTabType: string | null
  activeTabTypeByWorktree: Record<string, string>
  setActiveView: (view: string | null) => void
  // Orca store/slices/browser/browser-slice-contract.ts 契约签名；本地无内嵌浏览器，触达即抛错。
  createBrowserTab: (worktreeId: string, url: string, options?: CreateBrowserTabOptions) => BrowserWorkspace
  activeOrcaProfileId: string | null
  browserSessionProfilesByHostId: Partial<Record<ExecutionHostId, BrowserSessionProfile[]>>
  browserSessionProfiles: BrowserSessionProfile[]
  browserSessionHostIdOverride: ExecutionHostId | null
  // Orca store/slices/browser/browser-slice-contract.ts；本地无内嵌浏览器，无受管 profile 可建。
  ensureManagedBrowserSessionProfile: (
    owner: ManagedBrowserProfileOwner,
    label: string
  ) => NewBrowserTabProfile
  remoteBrowserPageHandlesByPageId: Record<string, RemoteBrowserPageHandle>
  // Orca store/slices/runtime-status/runtime-status-types.ts（多主机状态；本地恒空）
  runtimeStatusByEnvironmentId: Map<string, RuntimeEnvironmentStatus>
  floatingWorkspacePath: string | null
  // Orca store/terminals/terminal-state.ts（页签行持有恢复账本，用 TerminalTab 富类型）
  tabsByWorktree: Record<string, TerminalTab[]>
  activeWorkspaceKey: WorkspaceKey | null
  ptyIdsByTabId: Record<string, string[]>
  localOnlyScrollbackByTabId: Record<string, Record<string, string>>
  lastKnownRelayPtyIdByTabId: Record<string, string>
  lastVisitedAtByWorktreeId: Record<string, number>
  defaultTerminalTabsAppliedByWorktreeId: Record<string, true>
  activeTabId: string | null
  activeTabIdByWorktree: Record<string, string | null>
  tabBarOrderByWorktree: Record<string, string[]>
  setTabBarOrder: (worktreeId: string, order: string[]) => void
  // Orca store/slices/browser/browser-slice-contract.ts
  browserTabsByWorktree: Record<string, BrowserWorkspace[]>
  activeBrowserTabId: string | null
  activeBrowserTabIdByWorktree: Record<string, string | null>
  browserPagesByWorkspace: Record<string, BrowserPage[]>
  browserAnnotationsByPageId: Record<string, BrowserPageAnnotation[]>
  browserUrlHistory: BrowserHistoryEntry[]
  workspaceDocHistory: WorkspaceDocHistoryEntry[]
  browserCertificateFailuresByPageId: Record<string, BrowserCertificateFailure>
  // Orca store/terminals/terminal-state.ts
  terminalLayoutsByTabId: Record<string, TerminalLayoutSnapshot>
  runtimePaneTitlesByTabId: Record<string, Record<number, string>>
  pendingReconnectPtyIdByTabId: Record<string, string>
  deferredSshSessionIdsByTabId: Record<string, string>
  nativeChatLaunchDraftByTabId: Record<string, NativeChatLaunchDraft>
  workspaceSessionReady: boolean
  hydrationSucceeded: boolean
  // Orca store/slices/agent-status/contracts/agent-status-slice-contract.ts
  sleepingAgentSessionsByPaneKey: Record<string, SleepingAgentSessionRecord>
  // Orca store/slices/ssh/create-ssh-slice.ts + runtime-environment-ssh.ts
  sshConnectionStates: Map<string, SshConnectionState>
  sshStateByEnvironment: Map<string, RuntimeEnvironmentSshBucket>
  // Orca store/slices/settings/create-settings-slice.ts
  settings: GlobalSettings | null
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void>
  // Orca store/slices/ui/ui-slice-contract-preferences.ts（编辑器字号缩放；本地默认 0）。
  editorFontZoomLevel: number
  setEditorFontZoomLevel: (level: number) => void
  // Orca store/slices/keybindings/keybindings.ts（快捷键覆盖；本地默认无覆盖）
  keybindings: Partial<Record<string, string[]>>
  // Orca store/slices/agent-status/contracts/agent-status-slice-contract.ts（实时 agent 状态；
  // 本地无 AI 会话面板，恒为空表。用 ReadonlyMap 而非 Orca 的 AcceptedAgentStatuses 类，
  // 避免把 projection / status-ownership 的整套机制拉进来）。
  agentStatusByPaneKey: ReadonlyMap<string, AgentStatusEntry | undefined>
  // Orca store/slices/ui/ui-slice-contract-contextual.ts
  recordFeatureInteraction: (id: FeatureInteractionId) => Promise<void>
}
