// I-012 多标签栏（纯展示）：打开文件的标签 = 文件名 + dirty 圆点 + 关闭 ×。
// 数据（openFiles / dirty / active）由 App 从 store 投影；关闭确认在 App 层
// （dirty 关闭弹确认，clean 直接关）。
export type TabItem = {
  fileId: string
  label: string
  isDirty: boolean
  isActive: boolean
}

export function TabBar({
  tabs,
  onSelect,
  onClose
}: {
  tabs: TabItem[]
  onSelect: (fileId: string) => void
  onClose: (fileId: string) => void
}): React.JSX.Element | null {
  if (tabs.length === 0) {
    return null
  }
  return (
    <div role="tablist" aria-label="打开的文件" className="flex items-stretch border-b border-border">
      {tabs.map((tab) => (
        <div
          key={tab.fileId}
          role="tab"
          aria-selected={tab.isActive}
          data-testid="editor-tab"
          data-active={tab.isActive ? 'true' : 'false'}
          className={`group flex min-w-0 max-w-56 items-center gap-1.5 border-r border-border px-3 py-1.5 text-sm ${
            tab.isActive
              ? 'border-b-2 border-b-primary bg-muted/50 font-medium'
              : 'hover:bg-muted/40'
          }`}
        >
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left"
            title={tab.label}
            onClick={() => onSelect(tab.fileId)}
          >
            {tab.isDirty && (
              <span data-testid="dirty-dot" className="mr-1 text-primary" aria-label="未保存">
                ●
              </span>
            )}
            <span className="align-middle">{tab.label}</span>
          </button>
          <button
            type="button"
            data-testid="tab-close"
            aria-label={`关闭 ${tab.label}`}
            className="shrink-0 rounded px-1 text-muted-foreground opacity-60 hover:bg-background hover:opacity-100"
            onClick={() => onClose(tab.fileId)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
