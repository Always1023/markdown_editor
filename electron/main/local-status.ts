// 本地会话状态：status.get 的承接。Orca 的 runtime status 图（多主机 / 会话代次）
// 本地形态只有「本机可达」一个事实；其余字段恒空。
export function statusGetLocalSession(): Record<string, unknown> {
  return {
    ok: true,
    host: 'local',
    runtimeId: 'local-single',
    environments: [],
    worktrees: [],
    capabilities: [
      'files.write.disk-precondition.v1',
      'files.write.identical-noop.v1'
    ]
  }
}
