// 摘除适配（本产品不做 native-chat 引用）：选区引用恒 null（消费点仅在
// chat 工作区路径非空时调用）。
export function readMarkdownPreviewChatSelection(
  _root: HTMLElement,
  _content: string,
  _chatRelativePath: string
): string | null {
  return null
}
