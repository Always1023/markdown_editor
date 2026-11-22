// @vitest-environment happy-dom
// I-012 机检探针：多标签栏（打开即建标签 / 点击切换 / dirty 关闭确认 / clean 直接关）。
// 整只 App 真装配（RichMarkdownEditor 真渲染，window.api 接主进程本地实现，
// 工作目录为临时盘区，结束清理）。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../../src/app/App'
import { useAppStore } from '../../src/store/index'
import { installDemoWorkspaceState } from '../../src/app/demo-file-io'
import { installDemoWindowApi, resetFsChangedListeners } from './helpers/demo-window-api'

let root: string

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'me-tabs-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  resetFsChangedListeners()
  installDemoWindowApi()
  // 全局 store 跨测试保留状态：回滚到初始态再装配本测试的工作区。
  useAppStore.setState(useAppStore.getInitialState(), true)
  installDemoWorkspaceState(useAppStore, root)
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

const WELCOME_TEXT = 'markdown_editor'
const PLAN_TEXT = '切换计划文档'

async function setup(): Promise<ReturnType<typeof render>> {
  await writeFile(join(root, 'welcome.md'), `# ${WELCOME_TEXT}\n\n欢迎内容\n`, 'utf-8')
  await writeFile(join(root, 'plan.md'), `# ${PLAN_TEXT}\n\n计划内容\n`, 'utf-8')
  const harness = render(<App />)
  // 初始文件自动打开 → 第一个标签出现。
  await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
  // 从文件树打开第二个文件。
  fireEvent.click(screen.getByText('plan.md'))
  await waitFor(() => {
    expect(screen.getAllByTestId('editor-tab')).toHaveLength(2)
  }, { timeout: 10_000 })
  return harness
}

function tabByLabel(label: string): HTMLElement {
  const tab = screen
    .getAllByTestId('editor-tab')
    .find((candidate) => candidate.textContent?.includes(label))
  if (!tab) {
    throw new Error(`找不到标签：${label}`)
  }
  return tab
}

// store 内 filePath 为 workDir + '/' + 文件名（混合分隔符）；比较前归一化。
function norm(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase()
}

function findOpenFile(fileName: string): { id: string } | undefined {
  return useAppStore
    .getState()
    .openFiles.find((candidate) => norm(candidate.filePath) === norm(join(root, fileName)))
}

describe('I-012 A1 打开即建标签', () => {
  it('两个文件 → 两个标签、激活态落在后开的文件上', async () => {
    await setup()
    const planTab = tabByLabel('plan.md')
    expect(planTab.getAttribute('data-active')).toBe('true')
    const welcomeTab = tabByLabel('welcome.md')
    expect(welcomeTab.getAttribute('data-active')).toBe('false')
  })
})

describe('I-012 A2 点击切换', () => {
  it('点击标签 → 激活切换、编辑器内容跟随', async () => {
    await setup()
    // 初始激活 plan.md → 编辑器显示计划内容。
    await waitFor(
      () => {
        expect(document.body.textContent).toContain(PLAN_TEXT)
      },
      { timeout: 20_000 }
    )
    // 切回 welcome.md → 显示欢迎内容。
    fireEvent.click(within(tabByLabel('welcome.md')).getByText('welcome.md'))
    await waitFor(
      () => {
        expect(tabByLabel('welcome.md').getAttribute('data-active')).toBe('true')
        expect(document.body.textContent).toContain(WELCOME_TEXT)
        expect(document.body.textContent).not.toContain(PLAN_TEXT)
      },
      { timeout: 20_000 }
    )
    // 再切回 plan.md。
    fireEvent.click(within(tabByLabel('plan.md')).getByText('plan.md'))
    await waitFor(
      () => {
        expect(document.body.textContent).toContain(PLAN_TEXT)
      },
      { timeout: 20_000 }
    )
  })
})

describe('I-012 A3 关闭与 dirty', () => {
  it('clean 关闭 → 标签直接消失', async () => {
    await setup()
    fireEvent.click(within(tabByLabel('plan.md')).getByTestId('tab-close'))
    await waitFor(
      () => {
        expect(screen.getAllByTestId('editor-tab')).toHaveLength(1)
      },
      { timeout: 10_000 }
    )
    expect(screen.queryAllByTestId('close-confirm-backdrop')).toHaveLength(0)
  })

  it('dirty 关闭 → 确认对话框；不保存关闭后标签消失', async () => {
    await setup()
    const welcomeFile = findOpenFile('welcome.md')
    expect(welcomeFile).toBeDefined()
    useAppStore.getState().markFileDirty(welcomeFile!.id, true)
    await waitFor(() => {
      expect(tabByLabel('welcome.md').querySelector('[data-testid="dirty-dot"]')).not.toBeNull()
    }, { timeout: 10_000 })

    fireEvent.click(within(tabByLabel('welcome.md')).getByTestId('tab-close'))
    await waitFor(
      () => {
        expect(screen.getByRole('dialog')).toBeTruthy()
      },
      { timeout: 10_000 }
    )

    fireEvent.click(screen.getByTestId('close-confirm-discard'))
    await waitFor(
      () => {
        expect(screen.getAllByTestId('editor-tab')).toHaveLength(1)
      },
      { timeout: 10_000 }
    )
  })

  it('dirty 关闭 → 取消后标签保留', async () => {
    await setup()
    const welcomeFile = findOpenFile('welcome.md')
    expect(welcomeFile).toBeDefined()
    useAppStore.getState().markFileDirty(welcomeFile!.id, true)
    fireEvent.click(within(tabByLabel('welcome.md')).getByTestId('tab-close'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    }, { timeout: 10_000 })
    fireEvent.click(screen.getByText('取消'))
    await waitFor(
      () => {
        expect(screen.queryAllByTestId('close-confirm-backdrop')).toHaveLength(0)
        expect(screen.getAllByTestId('editor-tab')).toHaveLength(2)
      },
      { timeout: 10_000 }
    )
  })
})

describe('I-012 补充：保存并关闭', () => {
  it('dirty 关闭 → 保存并关闭 → 磁盘更新 + 标签消失', async () => {
    await setup()
    const welcomeFile = findOpenFile('welcome.md')
    expect(welcomeFile).toBeDefined()
    useAppStore.getState().markFileDirty(welcomeFile!.id, true)
    useAppStore.getState().setEditorDraft(welcomeFile!.id, '# 保存后关闭\n')
    fireEvent.click(within(tabByLabel('welcome.md')).getByTestId('tab-close'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    }, { timeout: 10_000 })
    fireEvent.click(screen.getByTestId('close-confirm-save'))
    await waitFor(
      async () => {
        expect(screen.getAllByTestId('editor-tab')).toHaveLength(1)
        const onDisk = await readFile(join(root, 'welcome.md'), 'utf-8')
        expect(onDisk.startsWith('# 保存后关闭')).toBe(true)
      },
      { timeout: 10_000 }
    )
  })
})
