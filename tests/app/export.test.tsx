// @vitest-environment happy-dom
// I-017 机检探针：导出 HTML（含标题/表格节点、完整文档可独立打开）、
// PDF 管线（printToPDF 替身 → 磁盘 %PDF 头非空文件）、保存对话框
// （导出路径来自用户选择；取消不落盘）。
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/app/App'
import { useAppStore } from '../../src/store/index'
import { installDemoWorkspaceState } from '../../src/app/demo-file-io'
import { installDemoWindowApi, resetFsChangedListeners } from './helpers/demo-window-api'
import { setPdfPrinter } from '../../electron/main/export'

let root: string
let exportsRoot: string

const DOC = `# 导出探针\n\n| 列一 | 列二 |\n| --- | --- |\n| 甲 | 乙 |\n`

beforeEach(async () => {
  vi.clearAllMocks()
  setPdfPrinter(null)
  root = await mkdtemp(join(tmpdir(), 'me-export-doc-'))
  exportsRoot = await mkdtemp(join(tmpdir(), 'me-export-out-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  resetFsChangedListeners()
  installDemoWindowApi()
  useAppStore.setState(useAppStore.getInitialState(), true)
  installDemoWorkspaceState(useAppStore, root)
})

afterEach(() => {
  setPdfPrinter(null)
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
  await rm(exportsRoot, { recursive: true, force: true })
})

async function setup(): Promise<void> {
  await writeFileWelcome()
  render(<App />)
  await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
  await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).not.toBeNull(), {
    timeout: 30_000
  })
}

async function writeFileWelcome(): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(root, 'welcome.md'), DOC, 'utf-8')
}

async function waitExported(target: string): Promise<string> {
  await waitFor(
    () => {
      expect(screen.getByTestId('export-status').textContent).toContain('已导出')
    },
    { timeout: 10_000 }
  )
  return readFile(target, 'utf-8')
}

describe('I-017 A1 导出 HTML', () => {
  it('磁盘 HTML 含标题与表格节点，完整文档可独立打开', async () => {
    const target = join(exportsRoot, 'doc.html')
    installDemoWindowApi({
      chooseExportPath: () => ({ filePath: target, canceled: false })
    })
    await setup()
    fireEvent.click(screen.getByTestId('export-button'))
    fireEvent.click(screen.getByTestId('export-html'))
    const html = await waitExported(target)
    expect(html.toLowerCase().startsWith('<!doctype html')).toBe(true)
    expect(html).toContain('<h1')
    expect(html).toContain('<table>')
    expect(html).toContain('导出探针')
    expect(html).toContain('<title>')
  })
})

describe('I-017 A2 导出 PDF 管线', () => {
  it('printToPDF（替身）→ 磁盘 %PDF 头非空文件', async () => {
    setPdfPrinter(async () =>
      Buffer.from('%PDF-1.4\n%I-017-probe\n1 0 obj\ntrailer\n%%EOF\n', 'utf-8')
    )
    const target = join(exportsRoot, 'doc.pdf')
    installDemoWindowApi({
      chooseExportPath: () => ({ filePath: target, canceled: false })
    })
    await setup()
    fireEvent.click(screen.getByTestId('export-button'))
    fireEvent.click(screen.getByTestId('export-pdf'))
    const html = await waitExported(target)
    expect(html.length).toBeGreaterThan(8)
    expect(html.startsWith('%PDF-')).toBe(true)
  })
})

describe('I-017 A3 保存对话框', () => {
  it('导出路径来自用户选择；取消不落盘', async () => {
    const chosen = join(exportsRoot, 'renamed-from-dialog.html')
    let dialogArgs: unknown = null
    installDemoWindowApi({
      chooseExportPath: (args) => {
        dialogArgs = args
        return { filePath: chosen, canceled: false }
      }
    })
    await setup()
    fireEvent.click(screen.getByTestId('export-button'))
    fireEvent.click(screen.getByTestId('export-html'))
    const html = await waitExported(chosen)
    expect(dialogArgs).toBeTruthy()
    const args = dialogArgs as { defaultFileName: string }
    expect(args.defaultFileName).toBe('welcome.html')
    expect(html).toContain('导出探针')

    // 取消：状态提示，不落盘。
    installDemoWindowApi({
      chooseExportPath: () => ({ filePath: null, canceled: true })
    })
    fireEvent.click(screen.getByTestId('export-button'))
    fireEvent.click(screen.getByTestId('export-html'))
    await waitFor(
      () => {
        expect(screen.getByTestId('export-status').textContent).toContain('已取消')
      },
      { timeout: 10_000 }
    )
  })
})
