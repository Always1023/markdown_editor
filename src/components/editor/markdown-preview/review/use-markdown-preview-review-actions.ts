// 摘除适配（本产品不做 review-note 批注呈现）：review 动作集恒空——工具栏
// 由 canShowReviewTools 门控（批注关闭时不渲染），动作对象仅作 prop 传递。
export type MarkdownPreviewReviewActions = Record<string, unknown>

type ReviewActionsArgs = {
  foundation: Record<string, unknown>
  viewport: Record<string, unknown>
}

export function useMarkdownPreviewReviewActions(_args: ReviewActionsArgs): MarkdownPreviewReviewActions {
  return {}
}
