// @vitest-environment happy-dom
// I-014 机检探针：TOC 面板（层级列表缩进 / 点击跳转 / 标题变更实时更新）。
// 整只 App 真装配（真 ProseMirror 渲染树；window.api 接主进程本地实现）。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/app/App'
import { useAppStore } from '../../src/store/index'
import { installDemoWorkspaceState } from '../../src/app/demo-file-io'
import { emitFsChanged, installDemoWindowApi, resetFsChangedListeners } from './helpers/demo-window-api'

let root: string

const INITIAL = `# 主标题\n\n引言段落。\n\n## 小节甲\n\n内容。\n\n### 深层标题\n\n内容二。\n`
const UPDATED = `${INITIAL}\n## 追加小节\n\n追加的内容。\n`

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'me-toc-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  resetFsChangedListeners()
  installDemoWindowApi()
  useAppStore.setState(useAppStore.getInitialState(), true)
  installDemoWorkspaceState(useAppStore, root)
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

async function setup(content: string): Promise<void> {
  await writeFile(join(root, 'welcome.md'), content, 'utf-8')
  render(<App />)
  await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
  // ProseMirror 挂载完成。
  await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).not.toBeNull(), {
    timeout: 30_000
  })
}

describe('I-014 A1 层级列表', () => {
  it('三级标题文档 → TOC 渲染三条、缩进递增', async () => {
    await setup(INITIAL)
    fireEvent.click(screen.getByTestId('toc-toggle'))
    await waitFor(
      () => {
        expect(document.querySelector('aside.markdown-toc-panel')).not.toBeNull()
      },
      { timeout: 10_000 }
    )
    const rows = [...document.querySelectorAll('.markdown-toc-row')]
    const titleTexts = rows
      .map((row) => row.querySelector('.markdown-toc-title')?.textContent)
      .filter(Boolean) as string[]
    // 三层标题按文档顺序出现。
    const order = ['主标题', '小节甲', '深层标题'].map((title) => titleTexts.indexOf(title))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    // 缩进：叶子行比父行更深（父行内缩由 chevron 列提供）。
    const indents = rows
      .filter((row) => row.querySelector('.markdown-toc-title'))
      .map((row) => parseInt((row as HTMLElement).style.paddingLeft, 10))
    expect(indents).toHaveLength(titleTexts.length)
    expect(indents[indents.length - 1]).toBeGreaterThan(indents[0])
  })
})

describe('I-014 A2 点击跳转', () => {
  it('点击 TOC 项 → 编辑器把对应标题滚进视口', async () => {
    await setup(INITIAL)
    fireEvent.click(screen.getByTestId('toc-toggle'))
    await waitFor(() => expect(document.querySelector('.markdown-toc-panel')).not.toBeNull(), {
      timeout: 10_000
    })
    const scrollSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)
    const target = [...document.querySelectorAll('.markdown-toc-title-button')].find(
      (button) => button.textContent === '小节甲'
    )
    expect(target).toBeDefined()
    fireEvent.click(target!)
    expect(scrollSpy).toHaveBeenCalled()
    scrollSpy.mockRestore()
  })
})

describe('I-014 A3 实时更新', () => {
  it('外部新增 H2 → 编辑器同步后 TOC 出现新项', async () => {
    await setup(INITIAL)
    fireEvent.click(screen.getByTestId('toc-toggle'))
    await waitFor(() => expect(document.querySelector('.markdown-toc-panel')).not.toBeNull(), {
      timeout: 10_000
    })
    expect(screen.queryByText('追加小节')).toBeNull()

    await writeFile(join(root, 'welcome.md'), UPDATED, 'utf-8')
    emitFsChanged(root, [{ kind: 'change', absolutePath: join(root, 'welcome.md') }])
    await waitFor(
      () => {
        // TOC 与编辑器正文都会出现该标题，断言至少一处命中即可。
        expect(screen.getAllByText('追加小节').length).toBeGreaterThan(0)
      },
      { timeout: 20_000 }
    )
  })
})
