// worktreeId → 本地根路径注册表。渲染端在激活工作区时注册（ipc 'worktrees:register'）；
// runtime files.* 的 {worktree: 'id:xxx', relativePath} 参数由此解析为绝对路径。
// 本地单机没有远端 runtime：host 就是本机，root 就是磁盘目录。
const rootsByWorktreeId = new Map<string, string>()

export function registerRuntimeWorktreeRoots(entries: {
  worktreeId: string
  rootPath: string
}): void {
  rootsByWorktreeId.set(entries.worktreeId, entries.rootPath)
}

/** `id:xxx` → 注册的根路径；未注册或空 selector 抛可读错误。 */
export function resolveRuntimeWorktreeRoot(selector: unknown): string {
  const value = typeof selector === 'string' ? selector.trim() : ''
  if (value.length === 0) {
    throw new Error('[runtime-call] 缺少 worktree 选择器，无法解析文件路径')
  }
  const id = value.startsWith('id:') ? value.slice(3) : value
  const root = rootsByWorktreeId.get(id)
  if (!root) {
    throw new Error(
      `[runtime-call] worktree 未注册：${id}（渲染端需先经 worktrees:register 上报根路径）`
    )
  }
  return root
}

/** 注册表快照（调试 / 测试断言用）。 */
export function snapshotRuntimeWorktreeRoots(): Record<string, string> {
  return Object.fromEntries(rootsByWorktreeId.entries())
}
