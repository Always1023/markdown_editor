// I-016 设置持久化：localStorage 快照 + 启动恢复。失败可见（console.error），
// 不因持久化损坏阻塞启动（坏快照按无持久化处理）。
import type { GlobalSettings } from '@/shared/settings/global-settings-types'
import type { AppStoreApi } from '@/components/editor/save/queue/editor-save-queue-contract'

const STORAGE_KEY = 'markdown_editor:settings'

export function persistAppSettings(settings: GlobalSettings | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('[settings] 持久化写入失败', error)
  }
}

export function hydrateAppSettings(store: AppStoreApi): void {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.error('[settings] 持久化读取失败', error)
    return
  }
  if (!raw) {
    return
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GlobalSettings>
    void store.getState().updateSettings(parsed)
  } catch (error) {
    // 坏快照：清掉并按无持久化继续，不阻塞启动。
    console.error('[settings] 持久化快照损坏，已忽略', error)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 忽略清理失败
    }
  }
}
