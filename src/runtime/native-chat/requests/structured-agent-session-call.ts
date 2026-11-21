import '@/shared/agent-session/view/agent-session-attention-capabilities.ts'
import { AGENT_SESSION_REWIND_RUNTIME_CAPABILITY } from '@/shared/agent-session/capabilities/agent-session-runtime-capabilities.ts'
import '@/shared/agent-session/capabilities/structured-agent-session-surface-capabilities.ts'
import '@/shared/agent-session/lifecycle/stopping/agent-session-stop-capabilities.ts'
import '@/shared/agent-session/lifecycle/operations/agent-session-create-capabilities.ts'
import { callRuntimeRpc } from '../../rpc/calls/runtime-rpc-call'
import { runtimeEnvironmentSupportsCapability } from '../../rpc/compatibility/runtime-capability-proof'
import '../../hosts/capabilities/local-runtime-capabilities'
import '../../rpc/subscriptions/runtime-rpc-subscribe'
import { STRUCTURED_AGENT_SESSION_METHOD_TIMEOUT_MS } from './structured-agent-session-request-timeouts'
import type { RuntimeClientTarget } from '@/shared/remote-runtime/host-catalog/runtime-client-target.ts'

export async function callStructuredAgentSession<TResult>(
  target: RuntimeClientTarget,
  method: string,
  params?: unknown,
  /** For a caller that checked the remote host's compatibility itself, just before. */
  options: {
    skipCompatibilityCheck?: true
    beforeSend?: () => void
    expectedEnvironmentRuntimeId?: string
    expectedEnvironmentPairingRevision?: number
  } = {}
): Promise<TResult> {
  if (
    method === 'agentSession.rewind' &&
    target.kind === 'environment' &&
    !(await runtimeEnvironmentSupportsCapability(
      target.environmentId,
      AGENT_SESSION_REWIND_RUNTIME_CAPABILITY
    ))
  ) {
    throw new Error('Rewinding requires a newer Orca server. Update the server and try again.')
  }
  const timeoutMs = STRUCTURED_AGENT_SESSION_METHOD_TIMEOUT_MS.get(method)
  return timeoutMs === undefined && Object.keys(options).length === 0
    ? callRuntimeRpc<TResult>(target, method, params)
    : callRuntimeRpc<TResult>(target, method, params, {
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
        ...options
      })
}
