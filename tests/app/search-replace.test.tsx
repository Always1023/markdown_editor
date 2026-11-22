// @vitest-environment happy-dom
// I-015 机检探针：编辑器搜索替换（Ctrl+F 开关 / 计数与上下条 / 替换与全部替换）。
// 整只 App 真装配（真 ProseMirror；搜索 UI 已内置于 RichMarkdownEditorSurface）。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/app/App'
import { useAppStore } from '../../src/store/index'
import { installDemoWorkspaceState } from '../../src/app/demo-file-io'
import { installDemoWindowApi, resetFsChangedListeners } from './helpers/demo-window-api'

let root: string

const INITIAL = `# 标题\n\n- 苹果 一\n- 梨 二\n- 苹果 三\n\n段落 苹果 结尾。\n`

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'me-search-'))
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
  await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).not.toBeNull(), {
    timeout: 30_000
  })
}

function editableElement(): Element {
  const editable = document.querySelector('[contenteditable="true"]')
  if (!editable) {
    throw new Error('编辑器未挂载')
  }
  return editable
}

function searchStatus(): string {
  const status = document.querySelector('.rich-markdown-search-status')
  if (!status) {
    throw new Error('搜索状态未渲染')
  }
  return status.textContent ?? ''
}

function searchButtons(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.rich-markdown-search-button')]
}

describe('I-015 A1 搜索计数与上下条', () => {
  it('Ctrl+F 打开 → 3 处命中 → 下一/上一条移动激活', async () => {
    await setup(INITIAL)
    // Ctrl+F（target 在编辑器内才触发 openSearch）。
    fireEvent.keyDown(editableElement(), { key: 'f', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('.rich-markdown-search')).not.toBeNull(), {
      timeout: 10_000
    })
    const findInput = document.querySelector<HTMLInputElement>('.rich-markdown-search-input')!
    fireEvent.change(findInput, { target: { value: '苹果' } })
    await waitFor(() => expect(searchStatus()).toBe('1/3'), { timeout: 10_000 })
    // 下一（按钮序：prev / next / close）。
    fireEvent.click(searchButtons()[1])
    await waitFor(() => expect(searchStatus()).toBe('2/3'), { timeout: 10_000 })
    fireEvent.click(searchButtons()[1])
    await waitFor(() => expect(searchStatus()).toBe('3/3'), { timeout: 10_000 })
    // 上一。
    fireEvent.click(searchButtons()[0])
    await waitFor(() => expect(searchStatus()).toBe('2/3'), { timeout: 10_000 })
  })
})

describe('I-015 A2 替换与全部替换', () => {
  it('替换当前一处 → 草稿更新；全部替换 → 无残留', async () => {
    await setup(INITIAL)
    fireEvent.keyDown(editableElement(), { key: 'f', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('.rich-markdown-search')).not.toBeNull(), {
      timeout: 10_000
    })
    const findInput = document.querySelector<HTMLInputElement>('.rich-markdown-search-input')!
    fireEvent.change(findInput, { target: { value: '苹果' } })
    await waitFor(() => expect(searchStatus()).toBe('1/3'), { timeout: 10_000 })
    // 展开替换（Ctrl+H 或 toggle 按钮），填替换词。
    fireEvent.click(document.querySelector<HTMLButtonElement>('.rich-markdown-search-toggle')!)
    await waitFor(() => {
      expect(document.querySelectorAll('.rich-markdown-search-input')).toHaveLength(2)
    }, { timeout: 10_000 })
    const replaceInput = document.querySelectorAll<HTMLInputElement>(
      '.rich-markdown-search-input'
    )[1]!
    fireEvent.change(replaceInput, { target: { value: '香蕉' } })
    // 替换当前（replace 模式下按钮序：prev / next / close / replace / replace-all）。
    fireEvent.click(searchButtons()[3])
    await waitFor(
      () => {
        const state = useAppStore.getState()
        const file = state.openFiles.find((candidate) => candidate.filePath.includes('welcome.md'))
        const draft = state.editorDrafts[file!.id] ?? ''
        expect(draft.split('香蕉').length - 1).toBe(1)
        expect(draft.split('苹果').length - 1).toBe(2)
      },
      { timeout: 10_000 }
    )
    // 全部替换。
    fireEvent.click(searchButtons()[4])
    await waitFor(
      () => {
        const state = useAppStore.getState()
        const file = state.openFiles.find((candidate) => candidate.filePath.includes('welcome.md'))
        const draft = state.editorDrafts[file!.id] ?? ''
        expect(draft.split('苹果').length - 1).toBe(0)
        expect(draft.split('香蕉').length - 1).toBe(3)
        expect(searchStatus()).toContain('No results')
      },
      { timeout: 10_000 }
    )
  })
})

describe('I-015 A3 Ctrl+F / Esc', () => {
  it('Ctrl+F 打开面板；Esc 关闭', async () => {
    await setup(INITIAL)
    fireEvent.keyDown(editableElement(), { key: 'f', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('.rich-markdown-search')).not.toBeNull(), {
      timeout: 10_000
    })
    fireEvent.keyDown(editableElement(), { key: 'Escape' })
    await waitFor(
      () => expect(document.querySelector('.rich-markdown-search')).toBeNull(),
      { timeout: 10_000 }
    )
    // 再开（Esc 后状态已复位，仍可重新搜索）。
    fireEvent.keyDown(editableElement(), { key: 'f', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('.rich-markdown-search')).not.toBeNull(), {
      timeout: 10_000
    })
  })
})
