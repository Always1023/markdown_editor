// 运行环境 SSH 桶桩。Orca 原文件（237 行）维护每个环境的 SSH 连接状态桶；
// 本产品不做 SSH 主机（PRD「不做」多主机）。保留消费方引用的代次读取函数。
import type { SshConnectionState } from '@/shared/remote-runtime/ssh/ssh-types'

/** Orca store/slices/ssh/runtime-environment-ssh.ts 的桶类型（本地形状照抄）。 */
export type RuntimeEnvironmentSshBucket = {
  environmentId: string
  connectionStates: Map<string, SshConnectionState>
}

export function getEnvironmentSshStateGeneration(_environmentId: string): number {
  return 0
}

export function getEnvironmentSshTargetConnectionGeneration(
  _environmentId: string,
  _targetId: string
): number {
  return 0
}

export function getLocalSshTargetConnectionGeneration(_targetId: string): number {
  return 0
}
