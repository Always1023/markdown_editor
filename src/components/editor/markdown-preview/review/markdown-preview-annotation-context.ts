// 摘除适配（本产品不做 review-note 批注呈现）：迁移的 preview 渲染树按注解块包
// 装节点，这里提供恒等 no-op，让链路可用而不引入批注 UI。见看板「摘除边界」。
import { createContext, useContext, type ReactElement, type ReactNode } from 'react'
import type { MarkdownPreviewPositionNode } from '../render-tree/markdown-preview-types'

export type MarkdownPreviewBlockRange = { startLine: number; endLine: number }

export type MarkdownAnnotationRenderersValue = {
  wrapAnnotatedBlock(
    tag: keyof React.JSX.IntrinsicElements,
    node: MarkdownPreviewPositionNode | null | undefined,
    element: ReactElement
  ): ReactElement
  renderAnnotationControls(
    range: MarkdownPreviewBlockRange,
    blockKey: string,
    quote: string | null
  ): ReactNode | null
  getMarkdownCommentsForRange(range: MarkdownPreviewBlockRange): unknown[]
  handleAnnotatedMarkdownBlockClick(range: MarkdownPreviewBlockRange, event: React.MouseEvent): void
}

// 恒等 no-op：块原样返回、无控件、无批注。
export const NOOP_ANNOTATION_RENDERERS: MarkdownAnnotationRenderersValue = {
  wrapAnnotatedBlock: (_tag, _node, element) => element,
  renderAnnotationControls: () => null,
  getMarkdownCommentsForRange: () => [],
  handleAnnotatedMarkdownBlockClick: () => {}
}

export const MarkdownPreviewAnnotationContext = createContext<MarkdownAnnotationRenderersValue>(
  NOOP_ANNOTATION_RENDERERS
)

export function useMarkdownPreviewAnnotations(): MarkdownAnnotationRenderersValue {
  return useContext(MarkdownPreviewAnnotationContext)
}
