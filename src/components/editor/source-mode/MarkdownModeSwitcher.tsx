// I-013 三渲染模式切换器（纯展示）：rich / source / preview 三段，激活态高亮。
// 模式存储在 store.markdownViewMode（按 fileId），切换动作由 App 接 setMarkdownViewMode。
import type { MarkdownViewMode } from '@/store/slices/editor/types/open-file'

const MODES: Array<{ mode: MarkdownViewMode; label: string }> = [
  { mode: 'rich', label: '富文本' },
  { mode: 'source', label: '源码' },
  { mode: 'preview', label: '预览' }
]

export function MarkdownModeSwitcher({
  viewMode,
  onSelectMode
}: {
  viewMode: MarkdownViewMode
  onSelectMode: (mode: MarkdownViewMode) => void
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="渲染模式"
      data-testid="mode-switcher"
      className="flex items-center gap-1 rounded border border-border bg-background p-0.5"
    >
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={viewMode === mode}
          data-testid={`mode-${mode}`}
          className={`rounded px-2 py-0.5 text-xs ${
            viewMode === mode ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/50'
          }`}
          onClick={() => onSelectMode(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
