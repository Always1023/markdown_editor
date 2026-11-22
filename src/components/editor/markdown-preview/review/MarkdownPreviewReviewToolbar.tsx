// 摘除适配（本产品不做 review-note 批注呈现）：工具栏恒 null；消费点由
// canShowReviewTools（批注开关）门控，本产品恒为关闭。
export function MarkdownPreviewReviewToolbar(_props: {
  foundation: Record<string, unknown>
  reviewActions: Record<string, unknown>
  filePath: string
}): React.JSX.Element | null {
  return null
}
