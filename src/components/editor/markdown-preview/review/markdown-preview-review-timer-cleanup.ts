// 摘除适配（本产品不做 review-note 批注呈现）：无 review 定时器可清，no-op。
type MutableRefLike<T> = { current: T }

export function clearMarkdownPreviewReviewTimers(
  _attentionTimeoutRef: MutableRefLike<number | null>,
  _pendingTimeoutIds: number[]
): void {
  // no-op
}
