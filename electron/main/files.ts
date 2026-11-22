// 本地单机文件服务：渲染端 window.api.fs.* 的主进程实现。
// 语义与 Orca 的 ipc/filesystem（reads / mutations）对齐——connectionId / SSH 期望 /
// WSL 唤醒等远端参数本地恒缺省（单机形态没有远端主机）；写路径走 writeIfUnchanged
// CAS（AC-04：更新已存在文件的唯一路径），直写仅限新建文件。
import { promises as fsPromises } from 'node:fs'
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import type { FileWriteResult } from '@/shared/file-write/file-write-disk-precondition'
import { writeLocalTextFileWithDiskPrecondition } from './filesystem/local-file-io/local-disk-write-precondition'
import { replaceLocalFileBytesIfUnchanged } from './filesystem/local-file-io/local-disk-bytes-replace'
import { readLocalFileContent } from './filesystem/local-file-io/filesystem-file-content-inspection'
import { readLocalFileRange } from './filesystem/local-file-io/local-file-range-read'
import type { MarkdownDocument } from '@/shared/file-listing/file-document'
import type { ImportItemResult } from '@/shared/file-import/filesystem-import-result'

// 运行时经「打开文件夹」对话框注册的额外工作根（I-011）：进程内有效，不写入环境变量。
const runtimeWorkRoots = new Set<string>()

/** 注册并返回解析后的运行时工作根；FileService 的越权检查自此放行该目录。 */
export function addRuntimeWorkRoot(rootPath: string): string {
  const resolved = resolve(rootPath)
  runtimeWorkRoots.add(resolved)
  return resolved
}

// 本地形态的工作根：文件操作限制在这些根目录之下（A7 越权拒绝）。
// dev 与打包后都可从环境变量覆盖；空列表表示未配置（此时拒绝一切写）。
export function localWorkRoots(): string[] {
  const configured = process.env['MARKDOWN_EDITOR_ROOTS']
  const base =
    configured && configured.trim().length > 0
      ? configured
          .split(';')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .map((entry) => resolve(entry))
      : [resolve(process.cwd())]
  const merged = new Set(base)
  for (const root of runtimeWorkRoots) {
    merged.add(root)
  }
  return [...merged]
}

/** Resolve and require the path to sit under one of the work roots; throws on escape. */
export function requirePathInWorkRoots(target: string): string {
  const resolved = resolve(target)
  const roots = localWorkRoots()
  const inside = roots.some((root) => {
    const withSep = root.endsWith('\\') || root.endsWith('/') ? root : root + '\\'
    return (
      resolved === root ||
      resolved.startsWith(withSep) ||
      resolved.startsWith(root.replace(/\\/g, '/') + '/')
    )
  })
  if (!inside) {
    throw new Error(
      `[files] 路径越出工作目录，已拒绝：${resolved}（工作根：${roots.join('；')}）`
    )
  }
  return resolved
}

export async function readTextFile(args: { filePath: string }) {
  return readLocalFileContent(requirePathInWorkRoots(args.filePath))
}

export async function statFile(args: {
  filePath: string
}): Promise<{ size: number; isDirectory: boolean; mtime: number }> {
  const info = await stat(requirePathInWorkRoots(args.filePath))
  return { size: info.size, isDirectory: info.isDirectory(), mtime: info.mtimeMs }
}

export async function pathExists(args: { filePath: string }): Promise<boolean> {
  try {
    await stat(requirePathInWorkRoots(args.filePath))
    return true
  } catch {
    return false
  }
}

export async function readDirEntries(args: { dirPath: string }): Promise<
  Array<{ name: string; kind: 'file' | 'directory' | 'symlink' }>
> {
  const dir = requirePathInWorkRoots(args.dirPath)
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file'
  }))
}

export async function writeTextFile(args: {
  filePath: string
  content: string
  diskPrecondition?: {
    expectedSignature: string
    allowMissing?: boolean
    requireLosslessUtf8?: boolean
  }
}): Promise<FileWriteResult> {
  return writeLocalTextFileWithDiskPrecondition(
    requirePathInWorkRoots(args.filePath),
    args.content,
    args.diskPrecondition ?? undefined
  )
}

export async function writeFileBytes(args: {
  filePath: string
  bytes: Uint8Array
  diskPrecondition: { expectedSignature: string; allowMissing?: boolean }
}): Promise<FileWriteResult> {
  return replaceLocalFileBytesIfUnchanged(
    requirePathInWorkRoots(args.filePath),
    async (tempPath) => {
      await fsPromises.writeFile(tempPath, args.bytes)
    },
    args.diskPrecondition
  )
}

export async function createFile(args: { filePath: string }): Promise<void> {
  const target = requirePathInWorkRoots(args.filePath)
  await mkdir(dirname(target), { recursive: true })
  // 直写仅限新建：文件已存在时报错（clobber 保护）。
  await fsPromises.writeFile(target, '', { flag: 'wx' })
}

export async function createDirectory(args: { dirPath: string }): Promise<void> {
  await mkdir(requirePathInWorkRoots(args.dirPath), { recursive: true })
}

export async function renamePath(args: { oldPath: string; newPath: string }): Promise<void> {
  await rename(
    requirePathInWorkRoots(args.oldPath),
    requirePathInWorkRoots(args.newPath)
  )
}

export async function copyPath(args: {
  sourcePath: string
  destinationPath: string
}): Promise<void> {
  await copyFile(
    requirePathInWorkRoots(args.sourcePath),
    requirePathInWorkRoots(args.destinationPath)
  )
}

export async function deletePath(args: {
  targetPath: string
  permanent?: boolean
}): Promise<void> {
  const target = requirePathInWorkRoots(args.targetPath)
  if (args.permanent) {
    await rm(target, { recursive: true, force: false })
    return
  }
  // 非永久删除走回收站（与 Orca trash 语义一致）；shell 只能在 IPC 层引入。
  const { shell } = await import('electron')
  try {
    await shell.trashItem(target)
  } catch (error) {
    throw new Error(`[files] 移入回收站失败（文件可能不存在或被占用）：${target} · ${String(error)}`)
  }
}

export async function readFileChunk(args: {
  filePath: string
  offset: number
  length: number
}) {
  return readLocalFileRange(
    requirePathInWorkRoots(args.filePath),
    args.offset,
    args.length
  )
}

/** 文档同目录即图片目录（Orca 语义）：把外部文件拷入 destDir，重名时追加序号。 */
export async function importExternalPaths(args: {
  sourcePaths: string[]
  destDir: string
}): Promise<{ results: ImportItemResult[] }> {
  const dest = requirePathInWorkRoots(args.destDir)
  await mkdir(dest, { recursive: true })
  const results: ImportItemResult[] = []
  for (const source of args.sourcePaths) {
    const resolvedSource = requireImportSourcePath(source)
    const name = basename(resolvedSource)
    const ext = extname(name)
    const stem = name.slice(0, name.length - ext.length)
    let candidate = join(dest, name)
    let suffix = 1
    let renamed = false
    while (await pathExistsUnchecked(candidate)) {
      candidate = join(dest, `${stem}-${suffix}${ext}`)
      suffix += 1
      renamed = true
    }
    await copyFile(resolvedSource, candidate)
    results.push({
      sourcePath: resolvedSource,
      status: 'imported',
      destPath: candidate,
      kind: 'file',
      renamed
    })
  }
  return { results }
}

async function pathExistsUnchecked(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

/**
 * import 的来源校验：工作根内，或系统临时目录——后者只承载本应用
 * saveImageAsTempFile 产出的截图临时文件（拷入文档目录即完成迁移，源文件
 * 不被引用）。destDir 仍严格限制在工作根内。
 */
function requireImportSourcePath(source: string): string {
  const resolved = resolve(source)
  const { tmpdir } = require('node:os') as typeof import('node:os')
  const tmp = resolve(tmpdir())
  if (resolved === tmp || resolved.startsWith(tmp.endsWith('\\') ? tmp : tmp + '\\')) {
    return resolved
  }
  return requirePathInWorkRoots(resolved)
}

/** 收集目录树下的 Markdown 文档（阶段 3 文件树复用；I-009 只开单文件）。 */
export async function listMarkdownDocuments(args: {
  rootPath: string
}): Promise<MarkdownDocument[]> {
  const root = requirePathInWorkRoots(args.rootPath)
  const documents: MarkdownDocument[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 12) {
      return
    }
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue
      }
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
      } else if (/\.md$/i.test(entry.name)) {
        documents.push({
          filePath: full,
          relativePath: full.slice(root.length + 1),
          name: entry.name.replace(/\.md$/i, '')
        } as MarkdownDocument)
      }
    }
  }
  await walk(root, 0)
  documents.sort((a, b) => a.filePath.localeCompare(b.filePath))
  return documents
}

/** 截图粘贴的临时落盘（blob 管线第一站）：写入系统临时目录并返回路径。 */
export async function saveImageAsTempFile(args: {
  contentBase64: string
}): Promise<string> {
  const { tmpdir } = await import('node:os')
  // 命名随 Orca 的 agentSessionPastedImageName（orca-paste-<now>-<unique>.<ext>）：
  // 扩展名按字节签名判定，agents 信任扩展而非字节。
  const buffer = Buffer.from(args.contentBase64, 'base64')
  const { detectImageFileExtension } = await import(
    '@/shared/file-content/image-file-signature'
  )
  const extension = detectImageFileExtension(buffer) ?? 'png'
  const target = join(
    tmpdir(),
    `orca-paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  )
  await fsPromises.writeFile(target, buffer)
  return target
}
