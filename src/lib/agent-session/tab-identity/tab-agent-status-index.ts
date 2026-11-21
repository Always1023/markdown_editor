import type { TerminalAgent } from '@/shared/agent-status/identity/terminal-agent.ts'
// 摘除说明：AcceptedAgentStatuses 属 agent-status 状态所有权机制（store/slices/agent-status/
// status-ownership），本产品裁掉 AI 会话面板，compat 层以 ReadonlyMap 空表替代。
// 这两个选择器当前无调用点，入参改为与 compat 形状等价的结构类型（map 上无 projection，
// 恒返回空集；仅保签名供未来叶子迁移件引用）。
type AcceptedAgentStatusesLike = {
  projection: {
    tabPanes: (tabId: string, includeCompleted: boolean) => readonly TabAgentPane[]
  }
}
export type TabAgentPane = { readonly leafId: string; readonly agent: TerminalAgent }

export function selectLiveTabAgentPanes(
  statuses: AcceptedAgentStatusesLike,
  tabId: string
): readonly TabAgentPane[] {
  return statuses.projection.tabPanes(tabId, false)
}
export function selectCompletedTabAgentPanes(
  statuses: AcceptedAgentStatusesLike,
  tabId: string
): readonly TabAgentPane[] {
  return statuses.projection.tabPanes(tabId, true)
}
export function firstTabAgentExcludingLeaf(
  panes: readonly TabAgentPane[],
  excludedLeafId?: string
): TerminalAgent | null {
  for (const pane of panes) {
    if (pane.leafId !== excludedLeafId) {
      return pane.agent
    }
  }
  return null
}
