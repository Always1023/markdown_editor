// 摘除适配（本产品不做 native-chat 引用）：选区引用气泡恒 null。
import type { RefObject } from 'react'

export function SelectionAddToChatPopover(_props: {
  rootRef: RefObject<HTMLDivElement | null>
  enabled: boolean
  readQuotable: (root: HTMLElement) => string | null
  onAdd: (text: string, button: { left: number; bottom: number }) => void
}): React.JSX.Element | null {
  // 恒 null：本产品没有聊天宿主，气泡永不展示。
  return null
}
