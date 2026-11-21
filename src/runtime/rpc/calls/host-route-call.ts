// 本地单机形态的 host 路由调用。Orca 原实现（47 行）在转发前查 host-operation-ownership
// 目录并捕获主机 identity fence（防主机漂移的写安全）；本产品的「主机」恒为本机，
// ownership 目录与 fence 机制不迁移——路由直接转 callRuntimeRpc（local 目标走
// window.api.runtime.call，见 runtime-rpc-call.ts）。
import { callRuntimeRpc } from './runtime-rpc-call'
import type { HostRoute } from '../targets/runtime-client-target'

type HostRouteCallOptions = Pick<
  NonNullable<Parameters<typeof callRuntimeRpc>[3]>,
  'timeoutMs' | 'signal' | 'expectedEnvironmentRuntimeId'
>

/** The host behind the route changed while the call was in flight; it may or may not have run. */
export class HostRouteUnverifiableError extends Error {
  readonly verdict = 'unverifiable'
  constructor(readonly method: string) {
    super(`The host changed while ${method} was in flight; refresh to see whether it ran.`)
    this.name = 'HostRouteUnverifiableError'
  }
}

/**
 * Calls a host-owned method on the host the route names. Params stay endpoint-relative: the domain
 * adapter derives them from the same resource ref as the route. A reply whose identity fence moved
 * is never applied or retried; snapshot readers add their own data fence on top.
 */
export async function callHostRoute<TResult>(
  route: HostRoute,
  method: string,
  params?: unknown,
  options: HostRouteCallOptions = {}
): Promise<TResult> {
  return callRuntimeRpc<TResult>(route.target, method, params, options)
}
