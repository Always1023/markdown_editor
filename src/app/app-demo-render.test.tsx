// @vitest-environment happy-dom
// I-006 A2 机检：demo 页渲染出测试文档的标题 / 表格 / 任务列表节点。
// 环境说明：happy-dom 无 preload 桥（仅在 Electron 里注入）。I-009 起 App 走真实
// 文件 IO，这里 stub window.api（fs 直连主进程本地实现，工作目录为临时盘区，
// 结束清理），渲染路径与运行时一致。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render, waitFor } from '@testing-library/react'
import {
  readTextFile,
  statFile,
  pathExists,
  writeTextFile,
  deletePath
} from '../../electron/main/files'
import App from './App'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'me-demo-render-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  await writeFile(
    join(root, 'welcome.md'),
    '# markdown_editor\n\n渲染探针文档\n\n| 特性 | 状态 |\n| ---- | ---- |\n| 表格 | 存在 |\n\n- [x] 任务节点\n',
    'utf-8'
  )
  const fsApi = {
    readFile: readTextFile,
    stat: statFile,
    pathExists,
    writeFile: writeTextFile,
    deletePath,
    onFsChanged: () => () => {}
  }
  // 只挂 api（Electron 里 preload 就是这么注入的）；重建 window 会断裂 happy-dom 的 document 关联。
  const win = (globalThis as unknown as { window: Record<string, unknown> }).window
  win['api'] = {
    fs: fsApi,
    app: { getWorkDir: async () => ({ workDir: root }) }
  }
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

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
        expect(
          container.querySelector('[data-type="taskList"], ul[data-type="taskList"]')
        ).not.toBeNull()
      },
      { timeout: 20_000 }
    )
  })
})
