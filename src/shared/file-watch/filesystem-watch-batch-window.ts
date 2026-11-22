// 本地与运行时 watch 共用的防抖窗口（Orca 同名模块的本地子集）：
// 尾随防抖在持续写入下会饿死投递；用 leading 合并 tick + 固定节奏。
// 75ms 把原生 watcher 的首个事件与 ~50ms 尾巴并成一批，原子保存保持单批。
export const WATCH_BATCH_LEADING_MS = 75
export const WATCH_BATCH_INTERVAL_MS = 100

/** Delay before flushing a batch armed at `now`; `lastFlushAt` is 0 before the first flush. */
export function watchBatchFlushDelayMs(
  now: number,
  lastFlushAt: number,
  leadingMs: number = WATCH_BATCH_LEADING_MS,
  intervalMs: number = WATCH_BATCH_INTERVAL_MS
): number {
  // 上限取 intervalMs：墙钟回跳不能卡死投递。
  return Math.min(intervalMs, Math.max(leadingMs, lastFlushAt + intervalMs - now))
}
