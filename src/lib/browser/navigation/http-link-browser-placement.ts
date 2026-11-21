// HTTP 链接的浏览器页签安置桩。Orca 原实现把链接开进工作区的浏览器页签
// （可见页签复用 / 邻组放置 / 后台打开）；本产品没有内嵌浏览器（PRD「不做」），
// 链接路由到系统浏览器（阶段 3 接线）。保留类型与函数形状，消费方
// （http-link-routing / http-link-destinations）不需要改动。
import type { TabSplitTarget } from '@/store/slices/tabs/tabs-slice-contract'
import type { Tab, TabGroup } from '@/shared/workspace-layout/tab-groups/tab-types'
import type { GlobalSettings } from '@/shared/settings/global-settings-types'
import type { BrowserWorkspace } from '@/shared/browser/workspaces/browser-workspace-types'

export type HttpLinkBrowserPlacement = { targetGroupId: string } | { split: TabSplitTarget }

export type HttpLinkBrowserTabState = {
  layoutByWorktree?: Record<string, unknown>
  activeGroupIdByWorktree?: Record<string, string>
  activeView?: string
  setActiveView?: (view: string) => void
  groupsByWorktree?: Record<string, readonly Pick<TabGroup, 'id' | 'activeTabId'>[]>
  unifiedTabsByWorktree?: Record<
    string,
    readonly (Pick<Tab, 'id'> & Partial<Pick<Tab, 'contentType' | 'groupId' | 'lastFocusedAt'>>)[]
  >
  settings?: Partial<Pick<GlobalSettings, 'openLinksInAppInBackground'>> | null
  // 形状对齐 Orca 原签名；本地 compat 提供返回 undefined 的空实现。
  createBrowserTab?: (
    worktreeId: string,
    url: string,
    opts: Pick<
      import('@/store/slices/browser/browser-slice-contract').CreateBrowserTabOptions,
      'activate' | 'targetGroupId' | 'split'
    >
  ) => Pick<BrowserWorkspace, 'activePageId'> | undefined
}

export type HttpLinkBrowserRequestFields = {
  targetGroupId?: string
  split?: TabSplitTarget
  focusOnCreate?: boolean
  selectWorktree?: boolean
}

/** 没有内嵌浏览器可复用；安置解析恒空，调用方退到外部打开。 */
export function resolveHttpLinkBrowserPlacement(
  _state: Omit<HttpLinkBrowserTabState, 'createBrowserTab'>,
  _worktreeId: string
): HttpLinkBrowserPlacement | null {
  return null
}

export function isHttpLinkBackgroundOpen(
  state: Pick<HttpLinkBrowserTabState, 'settings'>
): boolean {
  return state.settings?.openLinksInAppInBackground === true
}

/** 内嵌浏览器页签不存在；触达即抛错，链接应走外部浏览器路径。
 *  形状对齐 Orca 原签名（placement / activate 有默认值），调用方按 5 参传参。 */
export function openLocalHttpLinkTab(
  _state: HttpLinkBrowserTabState,
  _worktreeId: string,
  _url: string,
  _placement?: HttpLinkBrowserPlacement | null,
  _activate?: boolean
): void {
  throw new Error('[http-link] 内嵌浏览器未包含在本产品中：链接应由外部浏览器打开')
}

export function focusHttpLinkPage(_pageId: string | null | undefined): void {
  // 无内嵌浏览器，无页签聚焦。
}

export function prepareRemoteHttpLinkTab(
  _state: Omit<HttpLinkBrowserTabState, 'createBrowserTab'>,
  _worktreeId: string
): HttpLinkBrowserRequestFields {
  return {}
}

/** 无浏览器视图可切换；保留空实现以维持调用形状。 */
export function showWorkspaceTabs(
  _state: Pick<HttpLinkBrowserTabState, 'activeView' | 'setActiveView'>,
  _worktreeId: string
): void {}
