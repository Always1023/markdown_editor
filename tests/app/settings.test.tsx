// @vitest-environment happy-dom
// I-016 机检探针：设置面板（自动保存开关生效 / 缩放应用 / localStorage 持久化恢复）。
// 整只 App 真装配；localStorage 由 happy-dom 提供（用例间清理）。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/app/App'
import { useAppStore } from '../../src/store/index'
import { installDemoWorkspaceState } from '../../src/app/demo-file-io'
import { installDemoWindowApi, resetFsChangedListeners } from './helpers/demo-window-api'

let root: string

const INITIAL = `# 设置探针\n\n正文。\n`
const EDITED = `# 自动保存探针\n\n正文改写。\n`

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'me-settings-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  resetFsChangedListeners()
  installDemoWindowApi()
  useAppStore.setState(useAppStore.getInitialState(), true)
  installDemoWorkspaceState(useAppStore, root)
  localStorage.clear()
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

async function setup(): Promise<void> {
  await writeFile(join(root, 'welcome.md'), INITIAL, 'utf-8')
  render(<App />)
  await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
  await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).not.toBeNull(), {
    timeout: 30_000
  })
}

function openPanel(): void {
  fireEvent.click(screen.getByTestId('settings-open'))
  expect(screen.getByTestId('settings-panel')).toBeTruthy()
}

function welcomeFileId(): string {
  const file = useAppStore
    .getState()
    .openFiles.find((candidate) => candidate.filePath.includes('welcome.md'))
  if (!file) {
    throw new Error('welcome.md 未打开')
  }
  return file.id
}

async function readDisk(): Promise<string> {
  return readFile(join(root, 'welcome.md'), 'utf-8')
}

describe('I-016 A1 自动保存开关生效', () => {
  it('关 → 编辑后磁盘不动；开 → 恢复自动写盘', async () => {
    await setup()
    openPanel()
    const toggle = screen.getByTestId('setting-autosave') as HTMLInputElement
    expect(toggle.checked).toBe(true)
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(useAppStore.getState().settings?.editorAutoSave).toBe(false)
    }, { timeout: 10_000 })
    fireEvent.click(screen.getByTestId('settings-close'))

    // 关闭状态：编辑并标脏，防抖窗口过后磁盘不变。
    const fileId = welcomeFileId()
    useAppStore.getState().setEditorDraft(fileId, EDITED)
    useAppStore.getState().markFileDirty(fileId, true)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(await readDisk()).toBe(INITIAL)

    // 重新打开开关：恢复自动写盘。
    openPanel()
    fireEvent.click(screen.getByTestId('setting-autosave'))
    await waitFor(() => {
      expect(useAppStore.getState().settings?.editorAutoSave).toBe(true)
    }, { timeout: 10_000 })
    await waitFor(
      async () => {
        expect(await readDisk()).toBe(EDITED)
      },
      { timeout: 10_000 }
    )
  })
})

describe('I-016 A2 缩放', () => {
  it('+1 → editorFontZoomLevel 更新并应用到编辑器样式', async () => {
    await setup()
    openPanel()
    expect(useAppStore.getState().editorFontZoomLevel).toBe(0)
    fireEvent.click(screen.getByTestId('setting-zoom-in'))
    await waitFor(() => {
      expect(useAppStore.getState().editorFontZoomLevel).toBe(1)
    }, { timeout: 10_000 })
    // 编辑器 shell 的 CSS 变量跟随（应用面）。
    await waitFor(() => {
      const shell = document.querySelector<HTMLElement>('.rich-markdown-editor-shell')
      expect(shell).not.toBeNull()
      expect(shell!.style.getPropertyValue('--editor-font-zoom-level')).toBe('1')
    }, { timeout: 10_000 })
    expect(screen.getByTestId('setting-zoom-value').textContent).toBe('1')
    fireEvent.click(screen.getByTestId('settings-close'))
  })
})

describe('I-016 A3 持久化', () => {
  it('改设置 → localStorage 落盘；新会话（重置 store + 重渲染）后保留', async () => {
    await writeFile(join(root, 'welcome.md'), INITIAL, 'utf-8')
    const harness = render(<App />)
    await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
    openPanel()
    fireEvent.click(screen.getByTestId('setting-autosave'))
    await waitFor(() => {
      expect(useAppStore.getState().settings?.editorAutoSave).toBe(false)
    }, { timeout: 10_000 })
    // localStorage 快照已写入。
    const raw = localStorage.getItem('markdown_editor:settings')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).editorAutoSave).toBe(false)
    fireEvent.click(screen.getByTestId('settings-close'))
    // 卸载第一只 App（不卸载会留下重复元素）。
    harness.unmount()

    // 模拟重载：store 回初始态，重新挂载 App（启动装配含 hydrateAppSettings）。
    useAppStore.setState(useAppStore.getInitialState(), true)
    expect(useAppStore.getState().settings?.editorAutoSave).toBeUndefined()
    render(<App />)
    await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
    await waitFor(() => {
      expect(useAppStore.getState().settings?.editorAutoSave).toBe(false)
    }, { timeout: 20_000 })
    // 面板复选框反映恢复后的值。
    fireEvent.click(screen.getByTestId('settings-open'))
    expect((screen.getByTestId('setting-autosave') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByTestId('settings-close'))
  })
})
