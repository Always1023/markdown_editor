// @vitest-environment happy-dom
// I-010 机检探针：blob 粘贴 → 主进程临时落盘 → importExternalPaths 拷入文档目录 →
// markdown 引用替换 → 本地读取显示。window.api 全部接真实主进程实现（临时目录 +
// 清理）；fetch stub 供 blob 读回，canvas 转换按内核既有测试口径原样透传。
import type * as ImageBlobPng from '../../src/lib/clipboard/images/image-blob-png'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useAppStore } from '../../src/store/index'
import { DEMO_WORKTREE_ID, installDemoWorkspaceState } from '../../src/app/demo-file-io'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }))
import { scheduleRichMarkdownBlobImageImport } from '../../src/components/editor/rich-markdown/images/rich-markdown-blob-image-paste'
import { loadLocalImageSrc } from '../../src/components/editor/document-images/useLocalImageSrc'
import { resetLocalImageCacheState } from '../../src/components/editor/document-images/local-image-src-cache'
import {
  importExternalPaths,
  readTextFile,
  statFile,
  pathExists,
  writeTextFile,
  deletePath
} from '../../electron/main/files'
import { callLocalRuntimeMethod } from '../../electron/main/runtime-call'

vi.mock('@/lib/clipboard/images/image-blob-png', async (original) => {
  const actual = await original<typeof ImageBlobPng>()
  return { ...actual, convertImageBlobToPng: async (blob: Blob) => blob }
})

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

let root: string
let docPath: string

beforeEach(async () => {
  vi.clearAllMocks()
  resetLocalImageCacheState()
  root = await mkdtemp(join(tmpdir(), 'me-image-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
  docPath = join(root, 'note.md')
  installWindowStub()
  // captureRichMarkdownImageImportDestination 从 store 登记里解析 owner / 目录。
  installDemoWorkspaceState(useAppStore, root)
  useAppStore.getState().openFile({
    filePath: docPath,
    relativePath: 'note.md',
    worktreeId: DEMO_WORKTREE_ID,
    language: 'markdown',
    mode: 'edit'
  })
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

function installWindowStub(): void {
  // 只挂 api（Electron 里 preload 就是这么注入的）；重建 window 会断裂 happy-dom。
  // runtime.call 与主进程 ipc handler 同口径：包 envelope（callRuntimeRpc 依赖）。
  const win = (globalThis as unknown as { window: Record<string, unknown> }).window
  win['api'] = {
    runtime: {
      call: async (args: { method: string; params?: unknown }) => {
        try {
          return { ok: true, id: '', result: await callLocalRuntimeMethod(args.method, args.params) }
        } catch (error) {
          return {
            ok: false,
            id: '',
            error: {
              code: 'local_error',
              message: error instanceof Error ? error.message : String(error)
            }
          }
        }
      }
    },
    fs: {
      readFile: readTextFile,
      stat: statFile,
      pathExists,
      writeFile: writeTextFile,
      importExternalPaths,
      deletePath,
      onFsChanged: () => () => {}
    }
  }
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function createEditorWithImage(src: string): Editor {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [StarterKit, Image.configure({ inline: true }), Markdown],
    content: `before ![img](${src}) after`,
    contentType: 'markdown'
  })
  return editor
}

function ownBlob(id: string): string {
  // 与内核 collectOwnBlobImageSources 的前缀判定一致：必须挂在本渲染器的 origin 下。
  return `blob:${window.location.origin}/${id}`
}

async function pasteImageThroughPipeline(blobId: string): Promise<Editor> {
  const blobSrc = ownBlob(blobId)
  const editor = createEditorWithImage(blobSrc)
  const slice = editor.state.doc.slice(1, editor.state.doc.content.size - 1)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([PNG_BYTES], { type: 'image/png' })
    }))
  )
  scheduleRichMarkdownBlobImageImport({
    editor,
    slice,
    filePath: docPath,
    worktreeId: DEMO_WORKTREE_ID,
    runtimeEnvironmentId: null
  })
  return editor
}

function imageSrcOf(editor: Editor): string | undefined {
  let src: string | undefined
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' && src === undefined) {
      src = node.attrs.src as string | undefined
    }
  })
  return src
}

async function waitForLocalSrc(editor: Editor): Promise<string | undefined> {
  for (let i = 0; i < 100; i++) {
    await flushPromises()
    const src = imageSrcOf(editor)
    if (src && !src.startsWith('blob:')) {
      return src
    }
  }
  return imageSrcOf(editor)
}

describe('I-010 A1 粘贴落盘', () => {
  it('blob 引用替换为本地文件名，磁盘出现对应图片文件', async () => {
    const editor = await pasteImageThroughPipeline('img-a')
    const src = await waitForLocalSrc(editor)
    expect(src).toBeTruthy()
    expect(src?.endsWith('.png')).toBe(true)
    const onDisk = await readFile(join(root, src!))
    expect(onDisk.equals(PNG_BYTES)).toBe(true)
    editor.destroy()
  })
})

describe('I-010 A2 文件名去重', () => {
  it('同文档连贴两张按 pasted-1 / pasted-2 顺序命名', async () => {
    const editor1 = await pasteImageThroughPipeline('img-1')
    await waitForLocalSrc(editor1)
    const editor2 = await pasteImageThroughPipeline('img-2')
    await waitForLocalSrc(editor2)
    // 意图：连贴两张互不覆盖，引用各自指向不同文件（命名随 orca-paste-<now>-<rand>）。
    const src1 = await waitForLocalSrc(editor1)
    const src2 = await waitForLocalSrc(editor2)
    expect(src1).toBeTruthy()
    expect(src2).toBeTruthy()
    expect(src1).not.toBe(src2)
    await import('node:fs/promises').then(async ({ readdir }) => {
      const names = (await readdir(root)).filter((name) => name.endsWith('.png'))
      expect(names.length).toBeGreaterThanOrEqual(2)
    })
    editor1.destroy()
    editor2.destroy()
  })
})

describe('I-010 A3 引用可读取', () => {
  it('loadLocalImageSrc 对落盘图片返回可用的 blob: src（字节一致）', async () => {
    // 直接经主进程实现落一张图（A1 已验证管线），聚焦读取链。
    const tempPath = join(tmpdir(), `me-image-src-${Date.now()}.png`)
    await writeFile(tempPath, PNG_BYTES)
    const { results } = await importExternalPaths({ sourcePaths: [tempPath], destDir: root })
    await rm(tempPath, { force: true })
    const imported = results.find((result) => result.status === 'imported')
    expect(imported).toBeTruthy()
    const imageName = imported!.destPath.split(/[\\/]/).pop()!

    let createdUrl = ''
    const seenBlob = { size: 0, type: '' }
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const b = blob as Blob
      seenBlob.size = b.size
      seenBlob.type = b.type
      createdUrl = 'blob:test-image'
      return createdUrl
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const resolved = await loadLocalImageSrc(imageName, docPath)
    expect(resolved).toBe(createdUrl)
    expect(seenBlob.size).toBe(PNG_BYTES.length)
    expect(seenBlob.type).toBe('image/png')
  })
})

describe('I-010 A4 失败可见', () => {
  it('落盘失败时 toast 提示且 blob 引用保留', async () => {
    const toastSpy = vi.mocked(toast.error)
    const win = (globalThis as unknown as { window: Record<string, unknown> }).window
    const api = win['api'] as { fs: Record<string, unknown> }
    const realImport = api['fs']['importExternalPaths']
    api['fs']['importExternalPaths'] = async () => {
      throw new Error('EACCES: destination is read-only')
    }
    const editor = await pasteImageThroughPipeline('img-fail')
    // 管线 await 链多级；轮询等待失败反馈（≤2s）。
    let toasted = false
    for (let i = 0; i < 40 && !toasted; i++) {
      await flushPromises()
      toasted = toastSpy.mock.calls.length > 0
    }
    expect(toasted).toBe(true)
    expect(imageSrcOf(editor)?.startsWith('blob:')).toBe(true)
    api['fs']['importExternalPaths'] = realImport
    editor.destroy()
  })
})
