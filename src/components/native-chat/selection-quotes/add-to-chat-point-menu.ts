// 摘除适配（本产品不做 native-chat 引用）：加聊天入口恒 no-op。
export function openAddToChatMenuAt(_args: {
  worktreeId: string
  quote: unknown
  launchSource: string
  x: number
  y: number
}): void {
  // no-op
}
