// 迁移件（最小补齐）：只迁移 preview 链需要的两个滚动边距工具；
// VirtualizedList 组件本体属其他链路，本产品未接线不迁。
// Orca 同名文件对应函数逐字迁移（含注释）。

export function measureVirtualizedListScrollMargin(
  container: HTMLElement,
  scrollElement: HTMLElement
): number {
  return Math.round(
    container.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().top +
      scrollElement.scrollTop
  )
}

/** Observe list/sibling layout shifts, excluding subtree mutations because windowed row churn cannot move the list’s origin. */
export function observeVirtualizedListScrollMargin(
  container: HTMLElement,
  scrollElement: HTMLElement,
  onLayout: () => void
): () => void {
  const resizeObserver = new ResizeObserver(onLayout)
  resizeObserver.observe(container)
  resizeObserver.observe(scrollElement)
  let observedChildren = new Set<Element>()

  const observeScrollerChildren = (): void => {
    const currentChildren = new Set(scrollElement.children)
    // Prune detached sibling targets so long-lived lists do not retain stale DOM.
    for (const child of observedChildren) {
      if (!currentChildren.has(child) && child !== container) {
        resizeObserver.unobserve(child)
      }
    }
    for (const child of currentChildren) {
      resizeObserver.observe(child)
    }
    observedChildren = currentChildren
  }
  observeScrollerChildren()

  // Re-observe direct scroller children when siblings change so later resizes update this list’s offset.
  const mutationObserver = new MutationObserver(() => {
    observeScrollerChildren()
    onLayout()
  })
  mutationObserver.observe(scrollElement, { childList: true })

  return () => {
    resizeObserver.disconnect()
    mutationObserver.disconnect()
  }
}
