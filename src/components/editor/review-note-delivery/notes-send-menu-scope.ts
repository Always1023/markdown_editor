// 摘除说明：本目录原是 Orca 的审查笔记发送菜单（NotesSendMenu → AI agent 会话），
// 交付链（agent-message-send → structured-session launch 生态）随 I-003 整体摘除。
// 仅保留 scope 结构类型，供 review 层不可达分支（commentOwner 恒 null）维持签名。
export type NotesSendMenuScope<TNote> = {
  id: string
  label: string
  notes: readonly TNote[]
  /** The prompt for the notes this send carries: notes another send holds are left out. */
  formatPrompt: (notes: readonly TNote[]) => string
}
