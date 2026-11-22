// @vitest-environment node
// I-007 机检探针：本地文件服务纯函数 + runtime 路由，全部走临时目录（结束清理）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createDirectory,
  createFile,
  copyPath,
  deletePath,
  importExternalPaths,
  listMarkdownDocuments,
  pathExists,
  readDirEntries,
  readTextFile,
  renamePath,
  saveImageAsTempFile,
  statFile,
  writeTextFile
} from '../../electron/main/files'
import { callLocalRuntimeMethod } from '../../electron/main/runtime-call'
import { registerRuntimeWorktreeRoots } from '../../electron/main/worktree-roots'
import { getDiskBaselineSignature } from '@/shared/file-write/disk-baseline-signature'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'me-files-'))
  process.env['MARKDOWN_EDITOR_ROOTS'] = root
})

afterAll(async () => {
  delete process.env['MARKDOWN_EDITOR_ROOTS']
  await rm(root, { recursive: true, force: true })
})

describe('I-007 A1 读路径', () => {
  it('readTextFile / statFile / readDirEntries / pathExists 返回真实内容与元数据', async () => {
    const filePath = join(root, 'hello.md')
    await writeFile(filePath, '# 你好\n\n内容', 'utf-8')
    const read = await readTextFile({ filePath })
    expect(read.content).toBe('# 你好\n\n内容')
    expect(read.isBinary).toBe(false)
    const stat = await statFile({ filePath })
    expect(stat.size).toBe(Buffer.byteLength('# 你好\n\n内容', 'utf-8'))
    expect(stat.isDirectory).toBe(false)
    expect(stat.mtime).toBeGreaterThan(0)
    const entries = await readDirEntries({ dirPath: root })
    expect(entries.some((entry) => entry.name === 'hello.md' && entry.kind === 'file')).toBe(true)
    expect(await pathExists({ filePath })).toBe(true)
    expect(await pathExists({ filePath: join(root, 'missing.md') })).toBe(false)
  })
})

describe('I-007 A2 写路径 CAS', () => {
  it('新建直写成功；带正确基线签名写入成功；带过期签名被拒', async () => {
    const fresh = join(root, 'fresh.md')
    const freshWrite = await writeTextFile({ filePath: fresh, content: 'v1' })
    expect(freshWrite.ok).toBe(true)

    const existing = join(root, 'guarded.md')
    await writeTextFile({ filePath: existing, content: 'base' })
    const disk = await readFile(existing, 'utf-8')
    const signature = getDiskBaselineSignature(disk)
    const good = await writeTextFile({
      filePath: existing,
      content: 'next',
      diskPrecondition: { expectedSignature: signature, allowMissing: true }
    })
    expect(good.ok).toBe(true)

    const stale = await writeTextFile({
      filePath: existing,
      content: 'stale',
      diskPrecondition: {
        expectedSignature: getDiskBaselineSignature('base'),
        allowMissing: true
      }
    })
    expect(stale.ok).toBe(false)
    if (!stale.ok) {
      expect(stale.diskConflict).toBe('changed')
    }
    expect(await readFile(existing, 'utf-8')).toBe('next')
  })
})

describe('I-007 A3 变更族', () => {
  it('createFile / createDir / rename / copy / deletePath 在临时目录生效', async () => {
    const dir = join(root, 'mutation')
    await createDirectory({ dirPath: dir })
    const file = join(dir, 'a.md')
    await createFile({ filePath: file })
    expect(await pathExists({ filePath: file })).toBe(true)
    await expect(createFile({ filePath: file })).rejects.toThrow()

    const renamed = join(dir, 'b.md')
    await renamePath({ oldPath: file, newPath: renamed })
    expect(await pathExists({ filePath: file })).toBe(false)

    const copied = join(dir, 'c.md')
    await copyPath({ sourcePath: renamed, destinationPath: copied })
    expect(await pathExists({ filePath: copied })).toBe(true)

    await deletePath({ targetPath: copied, permanent: true })
    expect(await pathExists({ filePath: copied })).toBe(false)
  })
})

describe('I-007 A4 runtime 路由', () => {
  it('files.write / files.stat / files.read 经 worktree selector 与直连一致', async () => {
    registerRuntimeWorktreeRoots({ worktreeId: 'wt-test::/wt-test', rootPath: root })
    const write = await callLocalRuntimeMethod('files.write', {
      worktree: 'id:wt-test::/wt-test',
      relativePath: 'via-rpc.md',
      content: 'rpc 内容'
    })
    expect(write).toMatchObject({ ok: true })
    const stat = (await callLocalRuntimeMethod('files.stat', {
      worktree: 'id:wt-test::/wt-test',
      relativePath: 'via-rpc.md'
    })) as { size: number }
    expect(stat.size).toBe(Buffer.byteLength('rpc 内容', 'utf-8'))
    const read = (await callLocalRuntimeMethod('files.read', {
      worktree: 'id:wt-test::/wt-test',
      relativePath: 'via-rpc.md'
    })) as { content: string }
    expect(read.content).toBe('rpc 内容')
    const status = (await callLocalRuntimeMethod('status.get', {})) as {
      capabilities: string[]
    }
    expect(status.capabilities).toContain('files.write.disk-precondition.v1')
    await expect(callLocalRuntimeMethod('files.write', { worktree: 'id:unknown', relativePath: 'x' })).rejects.toThrow(/未注册/)
  })
})

describe('I-007 A5 图片临时落盘', () => {
  it('saveImageAsTempFile 落盘并可读回一致字节', async () => {
    const bytes = Buffer.from('fake-png-bytes', 'utf-8')
    const tempPath = await saveImageAsTempFile({ contentBase64: bytes.toString('base64') })
    const readBack = await readFile(tempPath)
    expect(readBack.equals(bytes)).toBe(true)
    await rm(tempPath, { force: true })
  })
})

describe('I-007 A7 越权拒绝', () => {
  it('工作根之外的写被拒且错误可读', async () => {
    await expect(
      writeTextFile({ filePath: join(tmpdir(), 'outside-escape.md'), content: 'x' })
    ).rejects.toThrow(/越出工作目录/)
  })
})

describe('I-007 补充：importExternalPaths 与 listMarkdownDocuments', () => {
  it('导入重名自动改名；文档清单按相对路径收集', async () => {
    const source = join(root, 'pasted.png')
    await writeFile(source, 'img-1', 'utf-8')
    const docsDir = join(root, 'docs')
    await mkdir(docsDir, { recursive: true })
    const docA = join(docsDir, 'note.md')
    await writeFile(docA, '# note', 'utf-8')

    const first = await importExternalPaths({ sourcePaths: [source], destDir: docsDir })
    const second = await importExternalPaths({ sourcePaths: [source], destDir: docsDir })
    expect(first.results[0]).toMatchObject({ status: 'imported', renamed: false })
    expect(second.results[0]).toMatchObject({ status: 'imported', renamed: true })
    expect(first.results[0].destPath).not.toBe(second.results[0].destPath)

    const documents = await listMarkdownDocuments({ rootPath: root })
    const names = documents.map((document) => document.filePath)
    expect(names).toContain(docA)
  })
})
