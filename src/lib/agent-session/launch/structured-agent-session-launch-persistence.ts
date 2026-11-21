// 摘除说明：本文件原是 Orca 结构化 agent 会话（AI chat 标签页）启动记录的持久化账本，
// 连带 launch-record / intent / create-call 等 12 个文件的自环生态。本产品无 AI 会话面板，
// 持久化会话里永远不会出现 agent 启动槽位；按同路径桩保留三个消费点的导出形状，
// 恒返回空集（readStructuredAgentLaunchRecords 空 → slots/signatures 恒空，行为正确）。
// 消费点：workspace-session-hydration-keys / workspace-session-unified-tabs / tabs-hydration。

export type StructuredAgentLaunchPersistedRecord = {
  executionHostId: string
  lifecycle: 'pending' | 'visibility-unknown' | 'failed'
  surfaceAddress?: {
    worktreeId: string
    targetGroupId?: string
    precedingTabIds: readonly string[]
  }
}

export function readStructuredAgentLaunchRecords(): readonly StructuredAgentLaunchPersistedRecord[] {
  return []
}

/** Each worktree's live local launch slots (target group and tab) as one comparable string, read in
 *  one pass, so a cached tab session can tell whether a worktree's slots changed. */
export function structuredLaunchSlotSignatures(): Map<string, string> {
  return new Map()
}

export function structuredLaunchSlotIds(worktreeId: string, groupId?: string): Set<string> {
  void worktreeId
  void groupId
  return new Set()
}
