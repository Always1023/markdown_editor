// 摘除适配（本产品不做 review-note 批注呈现）：返回恒 no-op 渲染器值，
// 使 MarkdownPreview 的注解上下文装配保持链路可用。
import { NOOP_ANNOTATION_RENDERERS, type MarkdownAnnotationRenderersValue } from './markdown-preview-annotation-context'

type AnnotationRenderersArgs = {
  foundation: Record<string, unknown>
  reviewActions: Record<string, unknown>
  filePath: string
  content: string
  markdownAnnotationsEnabled: boolean
}

export function useMarkdownPreviewAnnotationRenderers(
  _args: AnnotationRenderersArgs
): MarkdownAnnotationRenderersValue {
  return NOOP_ANNOTATION_RENDERERS
}
