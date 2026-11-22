// @vitest-environment happy-dom
// I-011 机检探针：文件树渲染 / 点击打开 / watch 刷新 / 换根（window.api 接真实主进程
// 实现，dialog 由 stub 控制；临时目录 + 清理）。stub 见 helpers/demo-window-api。
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { useAppStore } from '../../src/store/index'
import {
  installDemoWorkspaceState,
  openWorkspaceFile
} from '../../src/app/demo-file-io'
import { FileTree } from '../../src/components/file-tree/FileTree'
import { useFileTree } from '../../src/components/file-tree/use-file-tree'
import {
  emitFsChanged,
  installDemoWindowApi,
  resetFsChangedListeners
} from './helpers/demo-window-api'

let root: string

let chosenDirectory: string | null = null

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'me-tree-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  chosenDirectory = null
  resetFsChangedListeners()
  installDemoWindowApi({
    chooseWorkDir: () => {
      if (chosenDirectory) {
        return { workDir: chosenDirectory, canceled: false }
      }
      return { workDir: null, canceled: true }
    }
  })
  installDemoWorkspaceState(useAppStore, root)
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

function TreeHarness({
  onOpenRef,
  hookRef
}: {
  onOpenRef: { current: ((path: string) => void) | null }
  hookRef: { current: ReturnType<typeof useFileTree> | null }
}): React.JSX.Element {
  const tree = useFileTree()
  onOpenRef.current = (path: string) => {
    if (!tree.workDir) {
      return
    }
    void openWorkspaceFile({
      store: useAppStore,
      workDir: tree.workDir,
      filePath: path,
      onExternalReload: () => {}
    })
  }
  hookRef.current = tree
  return (
    <FileTree
      entries={tree.entries}
      activePath={null}
      onOpen={(path) => onOpenRef.current?.(path)}
    />
  )
}

describe('I-011 A1 树形列表', () => {
  it('临时目录嵌套 md 渲染出层级', async () => {
    await mkdir(join(root, 'projects'), { recursive: true })
    await writeFile(join(root, 'welcome.md'), '# 根文档', 'utf-8')
    await writeFile(join(root, 'projects', 'plan.md'), '# 子目录文档', 'utf-8')

    const onOpenRef: { current: ((path: string) => void) | null } = { current: null }
    const hookRef: { current: ReturnType<typeof useFileTree> | null } = { current: null }
    render(<TreeHarness onOpenRef={onOpenRef} hookRef={hookRef} />)
    await waitFor(
      () => {
        expect(screen.getByText('welcome.md')).toBeTruthy()
        expect(screen.getByText('projects')).toBeTruthy()
        expect(screen.getByText('plan.md')).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })
})

describe('I-011 A2 点击打开', () => {
  it('点击树节点 → openFile 登记 + 读入内容', async () => {
    await mkdir(join(root, 'projects'), { recursive: true })
    await writeFile(join(root, 'projects', 'plan.md'), '# 计划内容', 'utf-8')

    const onOpenRef: { current: ((path: string) => void) | null } = { current: null }
    const hookRef: { current: ReturnType<typeof useFileTree> | null } = { current: null }
    render(<TreeHarness onOpenRef={onOpenRef} hookRef={hookRef} />)
    await waitFor(() => screen.getByText('plan.md'), { timeout: 5000 })
    onOpenRef.current?.(join(root, 'projects', 'plan.md'))

    await waitFor(
      () => {
        const file = useAppStore
          .getState()
          .openFiles.find((candidate) => candidate.filePath === join(root, 'projects', 'plan.md'))
        expect(file).toBeDefined()
        expect(file?.lastKnownDiskSignature).toBeTruthy()
      },
      { timeout: 5000 }
    )
  })
})

describe('I-011 A3 watch 刷新', () => {
  it('根下新建 md + fs:changed → 树出现新节点', async () => {
    await writeFile(join(root, 'welcome.md'), '# 初始文档', 'utf-8')
    const onOpenRef: { current: ((path: string) => void) | null } = { current: null }
    const hookRef: { current: ReturnType<typeof useFileTree> | null } = { current: null }
    render(<TreeHarness onOpenRef={onOpenRef} hookRef={hookRef} />)
    await waitFor(() => screen.getByText('welcome.md'), { timeout: 5000 })

    await writeFile(join(root, 'late.md'), '# 迟到的文档', 'utf-8')
    emitFsChanged(root, [{ kind: 'create', absolutePath: join(root, 'late.md') }])
    await waitFor(() => screen.getByText('late.md'), { timeout: 5000 })
  })
})

describe('I-011 A4 打开文件夹', () => {
  it('chooseWorkDir 换根 → 树换成新目录内容', async () => {
    const other = await mkdtemp(join(tmpdir(), 'me-tree-other-'))
    await writeFile(join(other, 'other-note.md'), '# 别的目录', 'utf-8')
    await writeFile(join(root, 'welcome.md'), '# 初始文档', 'utf-8')

    const onOpenRef: { current: ((path: string) => void) | null } = { current: null }
    const hookRef: { current: ReturnType<typeof useFileTree> | null } = { current: null }
    render(<TreeHarness onOpenRef={onOpenRef} hookRef={hookRef} />)
    await waitFor(() => screen.getByText('welcome.md'), { timeout: 5000 })

    chosenDirectory = other
    // 模拟顶栏「打开文件夹」动作：hook 提供的换根入口。
    await hookRef.current?.chooseDirectory()
    await waitFor(() => screen.getByText('other-note.md'), { timeout: 5000 })
    await rm(other, { recursive: true, force: true })
  })
})
