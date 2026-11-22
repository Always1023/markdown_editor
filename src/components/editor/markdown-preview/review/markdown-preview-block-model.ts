// 摘除适配（本产品不做 review-note 批注呈现）：块坐标 / 引文提取只服务批注，
// 恒 null 让渲染树走「无批注」分支（见 markdown-preview-annotation-context）。
import type { ReactNode } from 'react'
import type { MarkdownPreviewPositionNode } from '../render-tree/markdown-preview-types'
import type { MarkdownPreviewBlockRange } from './markdown-preview-annotation-context'

export function getMarkdownPreviewBlockRange(
  _node: MarkdownPreviewPositionNode | null
): MarkdownPreviewBlockRange | null {
  return null
}

export function hasMarkdownPreviewNestedBlock(_node: MarkdownPreviewPositionNode): boolean {
  return false
}

export function getMarkdownPreviewAnnotationQuote(_children: ReactNode): string | null {
  return null
}
