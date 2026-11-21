// 本地单机形态的 RPC 客户端。Orca 原实现（runtime/rpc/calls/runtime-rpc-call.ts）把
// local 目标路由到 window.api.runtime.call，把 environment 目标路由到配对服务器链
// （兼容性探测、代次校验）。本产品没有远端运行时（PRD「不做」多主机）：local 路径
// 保持 Orca 原样（blob 图片粘贴等管线依赖它），environment 路径进入即抛错，失败可见。
import type { RuntimeClientTarget } from '@/shared/remote-runtime/host-catalog/runtime-client-target'
import type {
  RuntimeRpcFailure,
  RuntimeRpcResponse
} from '@/shared/remote-runtime/rpc/runtime-rpc-envelope'
import { RuntimeRpcCallError } from './runtime-rpc-result'

type RuntimeRpcCallOptions = {
  timeoutMs?: number
  suppressFeatureInteraction?: boolean
  reuseRecentCompatibilityFailure?: boolean
  skipCompatibilityCheck?: boolean
  signal?: AbortSignal
  expectedEnvironmentPairingRevision?: number
  expectedEnvironmentRuntimeId?: string
  beforeSend?: () => void
  paramsForStatus?: (status: unknown) => unknown
}

export async function callRuntimeRpc<TResult>(
  target: RuntimeClientTarget,
  method: string,
  params?: unknown,
  options: RuntimeRpcCallOptions = {}
): Promise<TResult> {
  if (options.signal?.aborted) {
    throw new RuntimeRpcCallError(
      failure('aborted', `runtime rpc aborted before send: ${method}`)
    )
  }
  // environment 目标属于被裁的多主机形态；兼容性探测 / 代次校验链不迁移，触达即失败可见。
  if (target.kind !== 'local') {
    throw new RuntimeRpcCallError(
      failure(
        'runtime_environment_changed',
        `[runtime-rpc] 本地形态没有远端运行时：${method} 的 environment 目标不可用。`
      )
    )
  }
  const nextParams = options.suppressFeatureInteraction
    ? withBrowserPaneUiRuntimeRpcSource(params)
    : params
  options.beforeSend?.()
  const response = (await window.api.runtime.call({
    method,
    params: nextParams
  })) as RuntimeRpcResponse<TResult>
  if (!response.ok) {
    throw new RuntimeRpcCallError(response)
  }
  return response.result
}

// Orca 的 withBrowserPaneUiRuntimeRpcSource 给浏览器面板 RPC 注入交互来源标记；
// 本地形态没有浏览器面板（PRD「不做」），参数原样返回。
function withBrowserPaneUiRuntimeRpcSource(params: unknown): unknown {
  return params
}

// 本地构造的失败 envelope：id 填空串（真实 envelope 由宿主生成）。
function failure(code: string, message: string): RuntimeRpcFailure {
  return { ok: false, id: '', error: { code, message } }
}
