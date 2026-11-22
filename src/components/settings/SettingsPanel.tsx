// I-016 设置面板：自动保存开关 / 编辑器缩放步进 / 拼写检查开关。改动经
// store.updateSettings 即时生效并持久化（localStorage）；缩放为会话级（Orca 同语义）。
import { useAppStore } from '@/store/index'

export function SettingsPanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  const editorFontZoomLevel = useAppStore((s) => s.editorFontZoomLevel)
  if (!open) {
    return null
  }
  const editorAutoSave = settings?.editorAutoSave ?? false
  const spellcheckEnabled = settings?.richMarkdownSpellcheckEnabled ?? true
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
      data-testid="settings-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        data-testid="settings-panel"
        className="w-80 rounded-md border border-border bg-background p-4 shadow-lg"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">设置</span>
          <button
            type="button"
            data-testid="settings-close"
            aria-label="关闭设置"
            className="rounded px-1 text-muted-foreground hover:bg-muted"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label className="flex items-center justify-between py-2 text-sm">
          <span>自动保存</span>
          <input
            type="checkbox"
            data-testid="setting-autosave"
            checked={editorAutoSave}
            onChange={() => {
              void useAppStore.getState().updateSettings({ editorAutoSave: !editorAutoSave })
            }}
          />
        </label>
        <div className="flex items-center justify-between py-2 text-sm">
          <span>编辑器缩放</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="setting-zoom-out"
              aria-label="缩小编辑器字体"
              className="rounded border border-border bg-background px-2 py-0.5 hover:bg-muted"
              onClick={() => useAppStore.getState().setEditorFontZoomLevel(editorFontZoomLevel - 1)}
            >
              −
            </button>
            <span data-testid="setting-zoom-value">{editorFontZoomLevel}</span>
            <button
              type="button"
              data-testid="setting-zoom-in"
              aria-label="放大编辑器字体"
              className="rounded border border-border bg-background px-2 py-0.5 hover:bg-muted"
              onClick={() => useAppStore.getState().setEditorFontZoomLevel(editorFontZoomLevel + 1)}
            >
              +
            </button>
          </div>
        </div>
        <label className="flex items-center justify-between py-2 text-sm">
          <span>拼写检查</span>
          <input
            type="checkbox"
            data-testid="setting-spellcheck"
            checked={spellcheckEnabled}
            onChange={() => {
              void useAppStore
                .getState()
                .updateSettings({ richMarkdownSpellcheckEnabled: !spellcheckEnabled })
            }}
          />
        </label>
      </div>
    </div>
  )
}
