// 摘除适配（本产品不做 review-note 批注呈现）：快捷键解析恒不消费，
// 活动块探测恒 false。
export type MarkdownPreviewAddReviewNoteKeyResult =
  | { action: 'consume' }
  | { action: 'clear-stale-and-ignore' }
  | { action: 'open'; blockKey: string }
  | { action: 'ignored' }

export function resolveMarkdownPreviewAddReviewNoteKey(_args: {
  event: KeyboardEvent
  platform: string
  keybindings: unknown
  targetInsidePreview: boolean
  markdownAnnotationsEnabled: boolean
  activeAnnotationBlockKey: string | null
  root: HTMLElement | null
  selection: Selection | null
}): MarkdownPreviewAddReviewNoteKeyResult {
  return { action: 'ignored' }
}

export function previewHasAnnotationBlockKey(
  _root: HTMLElement,
  _activeAnnotationBlockKey: string
): boolean {
  return false
}
