// 精简版标签页切片：本地单机形态的真实实现，管理 unifiedTabsByWorktree /
// groupsByWorktree / activeGroupIdByWorktree / layoutByWorktree。
// 与 Orca 版（store/slices/tabs/*，11 个子 creator + layout-owner RPC）的差异：
// 不走 layout-owner 通道（本地即 owner），不含终端 / 浏览器 / agent 会话的退场逻辑。
import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { TabsSlice, TabsSliceSet } from './tabs-slice-contract'
import type {
  Tab,
  TabContentType,
  TabGroup,
  TabGroupLayoutNode
} from '@/shared/workspace-layout/tab-groups/tab-types'
import type { WorkspaceSessionState } from '@/shared/workspace-session/workspace-session-state-types'
import type { WorkspaceSessionHydrationOptions } from '@/lib/workspace/persistence/workspace-session-hydration-keys'
import { addAdditionalValidWorkspaceKeys } from '@/lib/workspace/persistence/workspace-session-hydration-keys'
import {
  buildValidWorktreeIdsForSessionHydration,
  collectPersistedWorktreeIdsForSessionHydration
} from '@/shared/worktree/catalog/degraded-repo-worktree-validity'
import { buildHydratedTabState } from './tabs-hydration'
import { FLOATING_TERMINAL_WORKTREE_ID } from '@/shared/workspace/identity/floating-workspace-id'
import { folderWorkspaceKey } from '@/shared/workspace/identity/workspace-scope'
import { createNonSecureContextUuid as createId } from '@/shared/identifiers/non-secure-context-uuid'

type TabsGroupMap = Record<string, TabGroup[]>
type TabsMap = Record<string, Tab[]>

function groupsOf(state: AppState, worktreeId: string): TabGroup[] {
  return state.groupsByWorktree[worktreeId] ?? []
}

function tabsOf(state: AppState, worktreeId: string): Tab[] {
  return state.unifiedTabsByWorktree[worktreeId] ?? []
}

/** 群组列表 → 布局树：每个群组一个 leaf，与群组顺序一致。 */
function layoutOfGroups(groups: readonly TabGroup[]): TabGroupLayoutNode | null {
  if (groups.length === 0) {
    return null
  }
  let node: TabGroupLayoutNode = { type: 'leaf', groupId: groups[0].id }
  for (let i = 1; i < groups.length; i++) {
    node = { type: 'split', direction: 'horizontal', first: node, second: { type: 'leaf', groupId: groups[i].id } }
  }
  return node
}

function writeTabs(set: TabsSliceSet, worktreeId: string, tabs: Tab[]): void {
  set((state) => ({ unifiedTabsByWorktree: { ...state.unifiedTabsByWorktree, [worktreeId]: tabs } }))
}

function writeGroups(set: TabsSliceSet, worktreeId: string, groups: TabGroup[]): void {
  set((state) => ({
    groupsByWorktree: { ...state.groupsByWorktree, [worktreeId]: groups },
    layoutByWorktree: { ...state.layoutByWorktree, [worktreeId]: layoutOfGroups(groups) ?? state.layoutByWorktree[worktreeId] }
  }))
}

function findGroupOfTab(groups: readonly TabGroup[], tabId: string): TabGroup | undefined {
  return groups.find((group) => group.tabOrder.includes(tabId))
}

function selectInGroup(group: TabGroup, tabId: string): TabGroup {
  return { ...group, activeTabId: tabId }
}

export const createTabsSlice: StateCreator<AppState, [], [], TabsSlice> = (set, get) => {
  const createTabRecord = (
    worktreeId: string,
    contentType: TabContentType,
    groupId: string,
    init?: Partial<
      Pick<
        Tab,
        | 'id'
        | 'entityId'
        | 'executionHostId'
        | 'agentSessionAgent'
        | 'label'
        | 'generatedLabel'
        | 'quickCommandLabel'
        | 'customLabel'
        | 'color'
        | 'isPreview'
        | 'isPinned'
      >
    >
  ): Tab => ({
    id: init?.id ?? createId(),
    entityId: init?.entityId ?? '',
    groupId,
    worktreeId,
    contentType,
    label: init?.label ?? '',
    generatedLabel: init?.generatedLabel ?? null,
    customLabel: init?.customLabel ?? null,
    color: init?.color ?? null,
    sortOrder: tabsOf(get(), worktreeId).length,
    createdAt: Date.now(),
    ...(init?.executionHostId ? { executionHostId: init.executionHostId } : {}),
    ...(init?.agentSessionAgent ? { agentSessionAgent: init.agentSessionAgent } : {}),
    ...(init?.quickCommandLabel ? { quickCommandLabel: init.quickCommandLabel } : {}),
    ...(init?.isPreview ? { isPreview: init.isPreview } : {}),
    ...(init?.isPinned ? { isPinned: init.isPinned } : {})
  })

  const insertTabIntoGroup = (tab: Tab, groupId: string, index?: number, activate = true): void => {
    const worktreeId = tab.worktreeId
    const groups = groupsOf(get(), worktreeId).map((group) => ({ ...group }))
    let group = groups.find((entry) => entry.id === groupId)
    if (!group) {
      group = { id: groupId, worktreeId, activeTabId: null, tabOrder: [] }
      groups.push(group)
      writeGroups(set, worktreeId, groups)
    }
    const tabs = [...tabsOf(get(), worktreeId).filter((entry) => entry.id !== tab.id), tab]
    const order = group.tabOrder.filter((id) => id !== tab.id)
    order.splice(index ?? order.length, 0, tab.id)
    const updatedGroups = groupsOf(get(), worktreeId).map((entry) =>
      entry.id === groupId
        ? { ...entry, tabOrder: order, ...(activate ? { activeTabId: tab.id } : {}) }
        : entry
    )
    writeTabs(set, worktreeId, tabs)
    writeGroups(set, worktreeId, updatedGroups)
  }

  return {
    unifiedTabsByWorktree: {},
    groupsByWorktree: {},
    activeGroupIdByWorktree: {},
    splitLandingGroupIds: {},
    layoutByWorktree: {},

    createUnifiedTab: (worktreeId, contentType, init) => {
      const state = get()
      const groups = groupsOf(state, worktreeId)
      const requested = init?.targetGroupId
      const live = requested !== undefined && groups.some((group) => group.id === requested)
      const activeId = state.activeGroupIdByWorktree[worktreeId]
      const activeLive = activeId !== undefined && groups.some((group) => group.id === activeId)
      const groupId = live ? requested : activeLive ? activeId : (groups[0]?.id ?? createId())
      const tab = createTabRecord(worktreeId, contentType, groupId, init)
      // 单击打开替换同组的预览标签（预览开关关闭时不动）。
      const replacedPreview =
        init?.isPreview !== true &&
        !init?.isPinned &&
        groups
          .find((group) => group.id === groupId)
          ?.tabOrder.map((id) => tabsOf(state, worktreeId).find((entry) => entry.id === id))
          .find((entry) => entry?.isPreview === true && entry.contentType === contentType)
      if (replacedPreview) {
        closeTabRecord(replacedPreview.id, { captureRecentlyClosed: false })
      }
      insertTabIntoGroup(tab, groupId, init?.afterTabId ? undefined : undefined, init?.activate !== false)
      if (init?.afterTabId) {
        // 显式相邻插入：重排一次把新标签放到 afterTabId 后面。
        reorderWithinGroup(worktreeId, groupId, [
          ...groups
            .find((group) => group.id === groupId)
            ?.tabOrder.filter((id) => id !== tab.id)
            .flatMap((id) => (id === init.afterTabId ? [id, tab.id] : [id])) ?? [tab.id]
        ])
      }
      if (init?.activate !== false) {
        set((s) => ({ activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [worktreeId]: groupId } }))
      }
      if (init?.recordFocus !== false) {
        set((s) => ({
          unifiedTabsByWorktree: {
            ...s.unifiedTabsByWorktree,
            [worktreeId]: (s.unifiedTabsByWorktree[worktreeId] ?? []).map((entry) =>
              entry.id === tab.id ? { ...entry, lastFocusedAt: Date.now() } : entry
            )
          }
        }))
      }
      return tab
    },

    createUnifiedTabInSplit: (worktreeId, contentType, target, init) => {
      const groupId = createId()
      const tab = createTabRecord(worktreeId, contentType, groupId, init)
      const groups = [
        ...groupsOf(get(), worktreeId),
        { id: groupId, worktreeId, activeTabId: tab.id, tabOrder: [tab.id] }
      ]
      writeTabs(set, worktreeId, [...tabsOf(get(), worktreeId), tab])
      writeGroups(set, worktreeId, groups)
      if (init?.activate !== false) {
        set((s) => ({ activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [worktreeId]: groupId } }))
      }
      return tab
    },

    getTab: (tabId) => {
      for (const tabs of Object.values(get().unifiedTabsByWorktree)) {
        const hit = tabs.find((entry) => entry.id === tabId)
        if (hit) {
          return hit
        }
      }
      return null
    },

    getActiveTab: (worktreeId) => {
      const state = get()
      const groups = groupsOf(state, worktreeId)
      const groupId = state.activeGroupIdByWorktree[worktreeId] ?? groups[0]?.id
      const group = groups.find((entry) => entry.id === groupId)
      const tabId = group?.activeTabId ?? group?.tabOrder.at(-1)
      return tabId ? (tabsOf(state, worktreeId).find((entry) => entry.id === tabId) ?? null) : null
    },

    findTabForEntityInGroup: (worktreeId, groupId, entityId, contentType) => {
      const group = groupsOf(get(), worktreeId).find((entry) => entry.id === groupId)
      if (!group) {
        return null
      }
      return (
        tabsOf(get(), worktreeId).find(
          (entry) =>
            entry.entityId === entityId &&
            group.tabOrder.includes(entry.id) &&
            (contentType ? entry.contentType === contentType : true)
        ) ?? null
      )
    },

    activateTab: (tabId, opts) => {
      const state = get()
      for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
        const tab = tabs.find((entry) => entry.id === tabId)
        if (!tab) {
          continue
        }
        const groups = groupsOf(state, worktreeId).map((entry) =>
          entry.tabOrder.includes(tabId)
            ? selectInGroup(entry, tabId)
            : entry
        )
        writeGroups(set, worktreeId, groups)
        set((s) => ({
          activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [worktreeId]: tab.groupId }
        }))
        if (opts?.recordFocus !== false) {
          set((s) => ({
            unifiedTabsByWorktree: {
              ...s.unifiedTabsByWorktree,
              [worktreeId]: (s.unifiedTabsByWorktree[worktreeId] ?? []).map((entry) =>
                entry.id === tabId ? { ...entry, lastFocusedAt: Date.now() } : entry
              )
            }
          }))
        }
        return
      }
    },

    closeUnifiedTabs: (tabIds) => {
      for (const tabId of tabIds) {
        closeTabRecord(tabId, { captureRecentlyClosed: true })
      }
    },

    closeUnifiedTab: (tabId, opts) => {
      const state = get()
      const worktreeId = Object.entries(state.unifiedTabsByWorktree).find(([, tabs]) =>
        tabs.some((entry) => entry.id === tabId)
      )?.[0]
      if (!worktreeId) {
        return null
      }
      closeTabRecord(tabId, {
        captureRecentlyClosed: true,
        editorRetirementHandled: opts?.editorRetirementHandled
      })
      return { closedTabId: tabId, wasLastTab: (get().unifiedTabsByWorktree[worktreeId] ?? []).length === 0, worktreeId }
    },

    reorderUnifiedTabs: (groupId, tabIds) => {
      const state = get()
      for (const [worktreeId, groups] of Object.entries(state.groupsByWorktree)) {
        if (!groups.some((entry) => entry.id === groupId)) {
          continue
        }
        reorderWithinGroup(worktreeId, groupId, tabIds)
        return
      }
    },

    setTabLabel: (tabId, label) => {
      patchTab(tabId, { label, generatedLabel: null })
    },

    setTabViewMode: (tabId, mode) => {
      patchTab(tabId, { viewMode: mode })
    },

    toggleTabViewMode: (tabId) => {
      const tab = get().getTab(tabId)
      if (tab) {
        patchTab(tabId, { viewMode: tab.viewMode === 'chat' ? 'terminal' : 'chat' })
      }
    },

    setTabCustomLabel: (tabId, label) => {
      patchTab(tabId, { customLabel: label })
    },

    setUnifiedTabColor: (tabId, color) => {
      patchTab(tabId, { color })
    },

    pinTab: (tabId) => {
      patchTab(tabId, { isPinned: true })
    },

    unpinTab: (tabId) => {
      patchTab(tabId, { isPinned: false })
    },

    closeOtherTabs: (tabId) => {
      const tab = get().getTab(tabId)
      if (!tab) {
        return []
      }
      const group = groupsOf(get(), tab.worktreeId).find((entry) => entry.id === tab.groupId)
      const others = (group?.tabOrder ?? []).filter((id) => id !== tabId)
      for (const id of others) {
        closeTabRecord(id, { captureRecentlyClosed: true })
      }
      return others
    },

    closeTabsToRight: (tabId) => {
      return closeDirection(tabId, 'right')
    },

    closeTabsToLeft: (tabId) => {
      return closeDirection(tabId, 'left')
    },

    ensureWorktreeRootGroup: (worktreeId) => {
      const groups = groupsOf(get(), worktreeId)
      if (groups.length > 0) {
        return groups[0].id
      }
      const groupId = createId()
      writeGroups(set, worktreeId, [{ id: groupId, worktreeId, activeTabId: null, tabOrder: [] }])
      return groupId
    },

    focusGroup: (worktreeId, groupId) => {
      set((s) => ({ activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [worktreeId]: groupId } }))
    },

    closeEmptyGroup: (worktreeId, groupId) => {
      const groups = groupsOf(get(), worktreeId)
      const group = groups.find((entry) => entry.id === groupId)
      if (!group || group.tabOrder.length > 0 || groups.length === 1) {
        return false
      }
      const rest = groups.filter((entry) => entry.id !== groupId)
      writeGroups(set, worktreeId, rest)
      set((s) => {
        if (s.activeGroupIdByWorktree[worktreeId] !== groupId) {
          return s
        }
        return {
          activeGroupIdByWorktree: {
            ...s.activeGroupIdByWorktree,
            [worktreeId]: rest[0]?.id ?? ''
          }
        }
      })
      return true
    },

    createEmptySplitGroup: (worktreeId, _sourceGroupId, _direction, opts) => {
      const groupId = createId()
      const groups = [
        ...groupsOf(get(), worktreeId),
        { id: groupId, worktreeId, activeTabId: null, tabOrder: [] }
      ]
      writeGroups(set, worktreeId, groups)
      if (opts?.activate) {
        set((s) => ({ activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [worktreeId]: groupId } }))
      }
      return groupId
    },

    moveUnifiedTabToGroup: (tabId, targetGroupId, opts) => {
      const tab = get().getTab(tabId)
      if (!tab) {
        return false
      }
      const state = get()
      const target = groupsOf(state, tab.worktreeId).find((entry) => entry.id === targetGroupId)
      if (!target) {
        return false
      }
      const groups = groupsOf(state, tab.worktreeId).map((entry) =>
        entry.id === tab.groupId
          ? { ...entry, tabOrder: entry.tabOrder.filter((id) => id !== tabId), activeTabId: entry.activeTabId === tabId ? entry.tabOrder.filter((id) => id !== tabId).at(-1) ?? null : entry.activeTabId }
          : entry
      )
      const order = target.tabOrder.filter((id) => id !== tabId)
      order.splice(opts?.index ?? order.length, 0, tabId)
      const updated = groups.map((entry) =>
        entry.id === targetGroupId ? { ...entry, tabOrder: order } : entry
      )
      writeGroups(set, tab.worktreeId, updated)
      set((s) => ({
        unifiedTabsByWorktree: {
          ...s.unifiedTabsByWorktree,
          [tab.worktreeId]: (s.unifiedTabsByWorktree[tab.worktreeId] ?? []).map((entry) =>
            entry.id === tabId ? { ...entry, groupId: targetGroupId } : entry
          )
        }
      }))
      if (opts?.activate) {
        set((s) => ({ activeGroupIdByWorktree: { ...s.activeGroupIdByWorktree, [tab.worktreeId]: targetGroupId } }))
      }
      return true
    },

    dropUnifiedTab: (tabId, target) => {
      return get().moveUnifiedTabToGroup(tabId, target.groupId, { index: target.index, activate: true })
    },

    setTabGroupSplitRatio: () => {
      // 单 leaf 布局没有真实分栏；比例留空由布局层处理。
    },

    previewDragActiveTab: () => {
      // 本地形态没有拖拽跨层预览需求；保持空实现。
    },

    restoreDragActivationSnapshot: () => {},

    restoreSourceGroupActiveTabAfterDrop: () => {},

    reconcileWorktreeTabModel: (worktreeId) => {
      const state = get()
      const tabs = tabsOf(state, worktreeId)
      const groups = groupsOf(state, worktreeId)
      const knownIds = new Set(tabs.map((entry) => entry.id))
      const repaired = groups.map((entry) => ({
        ...entry,
        tabOrder: entry.tabOrder.filter((id) => knownIds.has(id))
      }))
      writeGroups(set, worktreeId, repaired)
      const activeGroupId = state.activeGroupIdByWorktree[worktreeId] ?? repaired[0]?.id ?? ''
      const activeGroup = repaired.find((entry) => entry.id === activeGroupId) ?? repaired[0]
      const activeRenderableTabId = activeGroup?.activeTabId ?? activeGroup?.tabOrder.at(-1) ?? null
      return { renderableTabCount: tabs.length, activeRenderableTabId }
    },

    reconcileWorktreeTabModels: (worktreeIds) => {
      for (const worktreeId of worktreeIds) {
        get().reconcileWorktreeTabModel(worktreeId)
      }
    },

    hydrateTabsSession: (session, options) => {
      // Orca tabs-session-actions.ts 的本地子集：会话快照 → 有效工作区过滤 →
      // buildHydratedTabState 重建页签结构。跳过 markFullResync / 页签模型 reconciliation
      // 批机制——那两类是终端 / 浏览器旧页签与 layout-owner seam 的修复面，本地形态
      // 只有编辑器页签，reconciliation 对空终端 / 浏览器桶是恒等。
      const state = get()
      const persistedWorktreeIds = collectPersistedWorktreeIdsForSessionHydration(session)
      const validWorktreeIds = buildValidWorktreeIdsForSessionHydration(state, persistedWorktreeIds)
      validWorktreeIds.add(FLOATING_TERMINAL_WORKTREE_ID)
      for (const workspace of (state.folderWorkspaces ?? []) as readonly { id: string }[]) {
        validWorktreeIds.add(folderWorkspaceKey(workspace.id))
      }
      addAdditionalValidWorkspaceKeys(validWorktreeIds, options)
      const hydrated = buildHydratedTabState(
        session,
        validWorktreeIds,
        undefined,
        new Set(options?.wslMovedChatWorkspaceKeys)
      )
      if (!options?.replaceWorkspaceKeys) {
        // 冷路径：整会话水合，重建每个工作区的页签状态。
        set(hydrated)
        return
      }
      const replaceWorkspaceKeys = new Set(options.replaceWorkspaceKeys)
      const replaceRecordKeys = <V>(
        currentRecord: Record<string, V>,
        hydratedRecord: Record<string, V>
      ): Record<string, V> => ({
        ...Object.fromEntries(
          Object.entries(currentRecord).filter(([key]) => !replaceWorkspaceKeys.has(key))
        ),
        ...Object.fromEntries(
          Object.entries(hydratedRecord).filter(([key]) => replaceWorkspaceKeys.has(key))
        )
      })
      set((current) => ({
        unifiedTabsByWorktree: replaceRecordKeys(
          current.unifiedTabsByWorktree,
          hydrated.unifiedTabsByWorktree
        ),
        groupsByWorktree: replaceRecordKeys(current.groupsByWorktree, hydrated.groupsByWorktree),
        activeGroupIdByWorktree: replaceRecordKeys(
          current.activeGroupIdByWorktree,
          hydrated.activeGroupIdByWorktree
        ),
        layoutByWorktree: replaceRecordKeys(current.layoutByWorktree, hydrated.layoutByWorktree)
      }))
    }
  }

  /** 关掉一条标签记录：从群组与列表移除，清理空群组（保底留一个 root 群组）。 */
  function closeTabRecord(
    tabId: string,
    _opts: { captureRecentlyClosed: boolean; editorRetirementHandled?: boolean }
  ): void {
    const state = get()
    for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
      const tab = tabs.find((entry) => entry.id === tabId)
      if (!tab) {
        continue
      }
      writeTabs(set, worktreeId, tabs.filter((entry) => entry.id !== tabId))
      const groupsBefore = groupsOf(state, worktreeId)
      const groups = groupsBefore
        .map((entry) =>
          entry.id === tab.groupId
            ? {
                ...entry,
                tabOrder: entry.tabOrder.filter((id) => id !== tabId),
                activeTabId:
                  entry.activeTabId === tabId
                    ? (entry.recentTabIds ?? entry.tabOrder)
                        .filter((id) => id !== tabId)
                        .at(-1) ?? null
                    : entry.activeTabId
              }
            : entry
        )
        .filter((entry) => entry.tabOrder.length > 0 || entry.id === groupsBefore[0]?.id)
      writeGroups(set, worktreeId, groups)
      const next = get()
      const nextGroups = next.groupsByWorktree[worktreeId] ?? []
      if (!nextGroups.some((entry) => entry.id === next.activeGroupIdByWorktree[worktreeId])) {
        set((s) => ({
          activeGroupIdByWorktree: {
            ...s.activeGroupIdByWorktree,
            [worktreeId]: nextGroups[0]?.id ?? ''
          }
        }))
      }
      return
    }
  }

  function patchTab(tabId: string, patch: Partial<Tab>): void {
    const state = get()
    for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
      if (!tabs.some((entry) => entry.id === tabId)) {
        continue
      }
      set((s) => ({
        unifiedTabsByWorktree: {
          ...s.unifiedTabsByWorktree,
          [worktreeId]: (s.unifiedTabsByWorktree[worktreeId] ?? []).map((entry) =>
            entry.id === tabId ? { ...entry, ...patch } : entry
          )
        }
      }))
      return
    }
  }

  function reorderWithinGroup(worktreeId: string, groupId: string, tabIds: string[]): void {
    const groups = groupsOf(get(), worktreeId).map((entry) =>
      entry.id === groupId ? { ...entry, tabOrder: tabIds } : entry
    )
    writeGroups(set, worktreeId, groups)
  }

  function closeDirection(tabId: string, side: 'left' | 'right'): string[] {
    const tab = get().getTab(tabId)
    if (!tab) {
      return []
    }
    const group = groupsOf(get(), tab.worktreeId).find((entry) => entry.id === tab.groupId)
    if (!group) {
      return []
    }
    const index = group.tabOrder.indexOf(tabId)
    const victims = side === 'right' ? group.tabOrder.slice(index + 1) : group.tabOrder.slice(0, index)
    for (const id of victims) {
      closeTabRecord(id, { captureRecentlyClosed: true })
    }
    return victims
  }
}
