// 本地单机的 runtime RPC 路由：渲染端 callRuntimeRpc({kind:'local'}, method, params)
// 经 preload 打到 window.api.runtime.call，这里按 method 名分发。
// files.* 的参数沿用 Orca 远端语义（{worktree: 'id:xxx', relativePath}），本地把
// selector 解析为注册表里的根路径（见 worktree-roots.ts）；clipboard.saveImageAsTempFile
// 与 status.get 由本地承接；layout.* 是页签布局通道（渲染端 own 布局，确认即回）。
import { join } from 'node:path'
import { statusGetLocalSession } from './local-status'
import { resolveRuntimeWorktreeRoot } from './worktree-roots'
import {
  importExternalPaths,
  readFileChunk,
  readDirEntries,
  readTextFile,
  statFile,
  writeFileBytes,
  writeTextFile,
  createDirectory,
  createFile,
  copyPath,
  deletePath,
  renamePath,
  listMarkdownDocuments,
  saveImageAsTempFile
} from './files'

type FileWriteDiskPrecondition = {
  expectedSignature: string
  allowMissing?: boolean
  requireLosslessUtf8?: boolean
}

type FileBytesWritePrecondition = { expectedSignature: string; allowMissing?: boolean }

/** 解析 {worktree, relativePath} → 绝对路径；相对路径拼根，绝对路径原样过根校验。 */
function resolveRuntimeFilePath(p: Record<string, unknown>): string {
  const relativePath = String(p['relativePath'] ?? '')
  if (relativePath.length === 0) {
    // 无 selector 形态的调用（本地直连风格）：绝对路径直接过根校验。
    return String(p['path'] ?? p['filePath'] ?? '')
  }
  const root = resolveRuntimeWorktreeRoot(p['worktree'])
  return relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)
    ? relativePath
    : join(root, relativePath)
}

export async function callLocalRuntimeMethod(
  method: string,
  params: unknown
): Promise<unknown> {
  const p = (params ?? {}) as Record<string, unknown>
  switch (method) {
    case 'files.read':
      return readTextFile({ filePath: resolveRuntimeFilePath(p) })
    case 'files.readChunk':
      return readFileChunk({
        filePath: resolveRuntimeFilePath(p),
        offset: Number(p['offset'] ?? 0),
        length: Number(p['length'] ?? 0)
      })
    case 'files.stat':
      return statFile({ filePath: resolveRuntimeFilePath(p) })
    case 'files.readDir':
      return readDirEntries({ dirPath: resolveRuntimeFilePath(p) })
    case 'files.write':
      return writeTextFile({
        filePath: resolveRuntimeFilePath(p),
        content: String(p['content'] ?? ''),
        diskPrecondition: p['diskPrecondition'] as FileWriteDiskPrecondition | undefined
      })
    case 'files.writeIfUnchanged':
      return writeTextFile({
        filePath: resolveRuntimeFilePath(p),
        content: String(p['content'] ?? ''),
        diskPrecondition: p['diskPrecondition'] as FileWriteDiskPrecondition | undefined
      })
    case 'files.writeBytes':
      return writeFileBytes({
        filePath: resolveRuntimeFilePath(p),
        bytes: decodeBase64(String(p['contentBase64'] ?? '')),
        diskPrecondition: p['diskPrecondition'] as FileBytesWritePrecondition
      })
    case 'files.createFile':
      return createFile({ filePath: resolveRuntimeFilePath(p) })
    case 'files.createDir':
      return createDirectory({ dirPath: resolveRuntimeFilePath(p) })
    case 'files.rename':
      return renamePath({
        oldPath: String(p['oldPath'] ?? ''),
        newPath: String(p['newPath'] ?? '')
      })
    case 'files.copy':
      return copyPath({
        sourcePath: String(p['sourcePath'] ?? ''),
        destinationPath: String(p['destinationPath'] ?? '')
      })
    case 'files.delete':
      return deletePath({
        targetPath: String(p['path'] ?? p['targetPath'] ?? ''),
        permanent: p['permanent'] === true
      })
    case 'files.listMarkdownDocuments':
      return listMarkdownDocuments({
        rootPath: resolveRuntimeWorktreeRoot(p['worktree'])
      })
    case 'files.importExternalPaths':
      return importExternalPaths({
        sourcePaths: (p['sourcePaths'] as string[]) ?? [],
        destDir: String(p['destDir'] ?? '')
      })
    case 'clipboard.saveImageAsTempFile':
      return saveImageAsTempFile({ contentBase64: String(p['contentBase64'] ?? '') })
    case 'status.get':
      return statusGetLocalSession()
    case 'layout.unsubscribe':
      // 渲染端持有布局，本地无订阅账本；确认即回。
      return { ok: true }
    default:
      throw new Error(
        `[runtime-call] 本地形态未实现的 RPC 方法：${method}（files.* / clipboard.saveImageAsTempFile / status.get / layout.* 之外的能力不在本产品范围）`
      )
  }
}

function decodeBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}
