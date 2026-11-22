// I-013 source 模式：Monaco 裸源码编辑面。本模块静态引 Monaco（monaco-setup 完成
// worker / loader.config / 语言注册），由 App 经 lazyWithRetry(() => import(本模块))
// 动态加载——Monaco 只经动态 import 进入主链（AC-08）。
import { Editor, type OnMount } from '@monaco-editor/react'
import { monaco } from '@/lib/editor/monaco/monaco-setup'

export type MonacoSourceEditorProps = {
  value: string
  onChange: (next: string) => void
  /** Ctrl+S / Cmd+S：交给外壳走 save queue。 */
  onSave: () => void
  readOnly?: boolean
}

export default function MonacoSourceEditor({
  value,
  onChange,
  onSave,
  readOnly = false
}: MonacoSourceEditorProps): React.JSX.Element {
  const handleMount: OnMount = (editor) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave()
    })
  }
  return (
    <Editor
      height="100%"
      language="markdown"
      value={value}
      theme="vs"
      onChange={(next) => onChange(next ?? '')}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false
      }}
    />
  )
}
