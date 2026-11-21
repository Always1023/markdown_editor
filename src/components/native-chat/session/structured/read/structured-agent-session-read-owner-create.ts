// 桩（来源 Orca components/native-chat/session/structured/read/structured-agent-session-read-owner-create.ts）。
// 结构化会话读通道依赖远端运行时（web runtime transport + history 分页读取），
// 本地单机形态没有远端宿主，也不创建结构化 agent 会话；读属主只存在「已退场」一种。
import type { StructuredAgentSessionReadOwner } from './structured-agent-session-read-owner-contract'
import type { RuntimeClientTarget } from '@/shared/remote-runtime/host-catalog/runtime-client-target'

export function createReadOwner(
  _key: string,
  _sessionId: string,
  _target: RuntimeClientTarget | null
): StructuredAgentSessionReadOwner {
  throw new Error('[read-owner] 本地形态没有远端运行时，不会创建结构化会话读属主')
}
