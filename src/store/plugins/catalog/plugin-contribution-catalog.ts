// 插件面板目录桩。Orca 原实现（store/plugins/catalog/*）扫描已安装插件并聚合
// 面板 / 命令 / 钩子贡献；本产品不加载插件（PRD「不做」），目录恒为空。
// 保留同一导出形状，消费方（save 管线的 editor-save-plugin-hook、字体挂载的
// plugin-fonts）读到的 plugins 列表恒空，钩子与字体自然跳过。
import { useMemo } from 'react'
import { create } from 'zustand'
import type { PluginHostListEntry } from '@/shared/plugins/plugin-list-entry'

type PluginPanelsState = {
  plugins: PluginHostListEntry[]
}

export const usePluginPanelsStore = create<PluginPanelsState>()(() => ({
  plugins: []
}))

/** Enabled and consented, whether or not a worker runs: its contributions are offered. */
// 恒空目录下不会被调用；保留 Orca 的判定语义。
export function isLivePlugin(plugin: PluginHostListEntry): boolean {
  return plugin.status === 'running' || plugin.status === 'restarting' || plugin.status === 'idle'
}

/** The plugin list loaded on first use, derived once per change; `derive` must be stable. */
// 本产品无插件宿主：列表恒空，不触发加载；derive 只在空表上执行一次。
export function usePluginListDerived<T>(derive: (plugins: readonly PluginHostListEntry[]) => T): T {
  const plugins = usePluginPanelsStore((state) => state.plugins)
  return useMemo(() => derive(plugins), [derive, plugins])
}
