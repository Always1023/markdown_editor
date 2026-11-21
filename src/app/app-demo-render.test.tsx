// @vitest-environment happy-dom
// I-006 A2 机检：demo 页渲染出测试文档的标题 / 表格 / 任务列表节点。
// 环境说明：happy-dom 无 window.api（preload 桥仅在 Electron 里注入），demo 的
// 纯渲染路径不触达系统能力；RPC 依赖的调用点在组件内部被 try/catch 吞掉（失败可见）。
import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import App from './App'

describe('I-006 demo page', () => {
  it('renders the demo document heading, table and task list', async () => {
    const { container } = render(<App />)
    await waitFor(
      () => {
        // ProseMirror 编辑器挂载（contenteditable 面板出现）
        const editable = container.querySelector('[contenteditable="true"]')
        expect(editable).not.toBeNull()
      },
      { timeout: 20_000 }
    )
    // 文档标题 / 表格 / 任务列表由 RichMarkdownEditor 的初始 content 渲染
    await waitFor(
      () => {
        const text = container.textContent ?? ''
        expect(text).toContain('markdown_editor')
        expect(container.querySelector('table')).not.toBeNull()
        expect(container.querySelector('[data-type="taskList"], ul[data-type="taskList"]')).not.toBeNull()
      },
      { timeout: 20_000 }
    )
  })
})
