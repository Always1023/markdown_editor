// @vitest-environment happy-dom
// I-013 机检探针：三渲染模式（source 装配与内容 / preview 渲染树 / round-trip 保真 /
// AC-08 动态 import）。整只 App 真装配。
// Monaco 说明：Monaco 真渲染依赖 worker + TextMate wasm，happy-dom 下不可靠（探针
// 实测 30s 超时）；source 探针改用装配级 mock（textarea 桩，value/onChange/onSave
// 同契约），Monaco 本体的挂载与观感由 AC-08 独立 chunk + A6 人验残差覆盖。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/app/App'
import { useAppStore } from '../../src/store/index'
import { installDemoWorkspaceState } from '../../src/app/demo-file-io'
import { installDemoWindowApi, resetFsChangedListeners } from './helpers/demo-window-api'

// 装配级 mock：与真 MonacoSourceEditor 的 props 契约一致（value / onChange / onSave）。
vi.mock('@/components/editor/source-mode/MonacoSourceEditor', async () => {
  const React = await import('react')
  return {
    default: function SourceEditorStub(props: {
      value: string
      onChange: (next: string) => void
      onSave: () => void
    }) {
      return React.createElement('textarea', {
        'data-testid': 'source-textarea',
        value: props.value,
        onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
        onKeyDown: (event: {
          ctrlKey: boolean
          metaKey: boolean
          key: string
          preventDefault: () => void
        }) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault()
            props.onSave()
          }
        }
      })
    }
  }
})

let root: string

const HEADING = '三模式探针'
const CODE_TEXT = 'const probe = true'
const SOURCE_EDIT = '# 源码改写标题'

const INITIAL = `# ${HEADING}\n\n| 列 A | 列 B |\n| ---- | ---- |\n| 1 | 2 |\n\n\`\`\`ts\n${CODE_TEXT}\n\`\`\`\n`

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'me-modes-'))
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

async function setup(): Promise<void> {
  await writeFile(join(root, 'welcome.md'), INITIAL, 'utf-8')
  render(<App />)
  await waitFor(() => screen.getAllByTestId('editor-tab'), { timeout: 20_000 })
}

function tabElement(): HTMLElement {
  const tab = screen
    .getAllByTestId('editor-tab')
    .find((candidate) => candidate.textContent?.includes('welcome.md'))
  if (!tab) {
    throw new Error('找不到 welcome.md 标签')
  }
  return tab
}

describe('I-013 A1 source 模式', () => {
  it('切 source → 编辑器装配挂载且文本与磁盘一致；编辑后保存写盘', async () => {
    await setup()
    fireEvent.click(screen.getByTestId('mode-source'))
    // 动态 chunk 加载 + 编辑面装配（mock 桩即挂载点）。
    const textarea = await screen.findByTestId('source-textarea', {}, { timeout: 20_000 })
    expect(textarea).not.toBeNull()
    // 编辑器文本与磁盘一致。
    expect((textarea as HTMLTextAreaElement).value).toBe(INITIAL)
    // 在 source 编辑器里改写 → onChange → draft；关闭确认「保存并关闭」→ 写盘。
    fireEvent.change(textarea, { target: { value: `${SOURCE_EDIT}\n` } })
    await waitFor(() => {
      expect(tabElement().querySelector('[data-testid="dirty-dot"]')).not.toBeNull()
    }, { timeout: 10_000 })
    fireEvent.click(tabElement().querySelector('[data-testid="tab-close"]')!)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy(), { timeout: 10_000 })
    fireEvent.click(screen.getByTestId('close-confirm-save'))
    await waitFor(
      async () => {
        const onDisk = await readFile(join(root, 'welcome.md'), 'utf-8')
        expect(onDisk.startsWith(SOURCE_EDIT)).toBe(true)
      },
      { timeout: 10_000 }
    )
  })
})

describe('I-013 A2 preview 模式', () => {
  it('切 preview → 渲染树输出标题 / 表格 / 代码块节点', async () => {
    await setup()
    fireEvent.click(screen.getByTestId('mode-preview'))
    await waitFor(
      () => {
        const host = screen.getByTestId('preview-host')
        expect(host.querySelector('h1')?.textContent).toContain(HEADING)
        expect(host.querySelector('table')).not.toBeNull()
        expect(host.querySelector('code')).not.toBeNull()
        expect(host.textContent).toContain(CODE_TEXT)
      },
      { timeout: 30_000 }
    )
  })
})

describe('I-013 A3 往返一致', () => {
  it('rich → source → rich 内容一致；source 改写 → rich 显示草稿且磁盘未写', async () => {
    await setup()
    // rich → source → rich（无编辑）：编辑器内容与磁盘一致。
    fireEvent.click(screen.getByTestId('mode-source'))
    await screen.findByTestId('source-textarea', {}, { timeout: 20_000 })
    expect((screen.getByTestId('source-textarea') as HTMLTextAreaElement).value).toBe(INITIAL)
    fireEvent.click(screen.getByTestId('mode-rich'))
    await waitFor(
      () => {
        const editable = document.querySelector('[contenteditable="true"]')
        expect(editable).not.toBeNull()
        expect(document.body.textContent).toContain(HEADING)
        expect(document.body.textContent).toContain(CODE_TEXT)
      },
      { timeout: 30_000 }
    )
    const onDisk = await readFile(join(root, 'welcome.md'), 'utf-8')
    expect(onDisk).toBe(INITIAL)

    // source 改写 → 回 rich：草稿进入富文本视图，磁盘仍未写（未保存）。
    fireEvent.click(screen.getByTestId('mode-source'))
    await screen.findByTestId('source-textarea', {}, { timeout: 20_000 })
    fireEvent.change(screen.getByTestId('source-textarea'), {
      target: { value: `${SOURCE_EDIT}\n` }
    })
    await waitFor(() => {
      expect(tabElement().querySelector('[data-testid="dirty-dot"]')).not.toBeNull()
    }, { timeout: 10_000 })
    fireEvent.click(screen.getByTestId('mode-rich'))
    await waitFor(
      () => {
        expect(document.body.textContent).toContain('源码改写标题')
      },
      { timeout: 30_000 }
    )
    const untouched = await readFile(join(root, 'welcome.md'), 'utf-8')
    expect(untouched).toBe(INITIAL)
  })
})

describe('I-013 A4 AC-08 动态 import', () => {
  it('App 经 lazyWithRetry(() => import(...)) 挂 MonacoSourceEditor', async () => {
    const appSource = await readFile(join(process.cwd(), 'src', 'app', 'App.tsx'), 'utf-8')
    expect(appSource).toMatch(/lazyWithRetry\(\s*\(\)\s*=>\s*import\('@\/components\/editor\/source-mode\/MonacoSourceEditor'\)/)
    // MonacoSourceEditor 模块内静态引 Monaco（chunk 内聚），App 主链不经静态 import。
    expect(appSource).not.toMatch(/import\s+(RichMarkdownEditor.*)?MonacoSourceEditor/)
  })
})
