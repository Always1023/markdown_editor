// 桩（来源 Orca diagnostics/telemetry/telemetry.ts，PostHog 埋点客户端）。
// 遥测属 Orca 运营面，本地单机产品不采集：track 恒为空操作，opt-in 状态恒「未启用」。
// 签名取宽松形态（string + Record），切断对 Orca 遥测 schema 注册表（20+ 文件）的类型依赖；
// 迁移件调用点只要求「可调用」，事件名安全由 Orca 主进程校验，本地形态不存在上报。
import type { TelemetryConsentState } from '@/shared/telemetry/telemetry-consent-types'

export const PRIVACY_URL = ''

export function recordAdmittedTerminalUserInput(): void {}

export function track(_name: string, _props?: Record<string, unknown>): void {}

export function trackWithResult(
  _name: string,
  _props: Record<string, unknown> | undefined,
  _result: 'success' | 'failure'
): void {}

export function setOptIn(_optedIn: boolean): Promise<void> {
  return Promise.resolve()
}

export function acknowledgeBanner(): Promise<void> {
  return Promise.resolve()
}

export function getConsentState(): Promise<TelemetryConsentState> {
  // 本地形态：无埋点通道，视为用户选择退出。
  return Promise.resolve({ effective: 'disabled', reason: 'user_opt_out' })
}
