// I-011 文件树数据源：加载工作根下的 markdown 文档列表，订阅 fs:changed 增量刷新，
// 并提供「打开文件夹」换根入口（chooseWorkDir 注册运行时工作根后重载 + 重新订阅）。
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarkdownDocument } from '@/shared/file-listing/file-document'
import type { FsChangedPayload } from '@/shared/file-watch/filesystem-change-event'

// watch 事件触发的重载去抖：I-008 批次窗口已合并事件，这里只防同帧多批次抖动。
const TREE_RELOAD_DEBOUNCE_MS = 150

export type FileTreeState = {
  /** 当前工作根（未就绪时 null）。 */
  workDir: string | null
  /** 根下的 markdown 文档（相对路径排序，由主进程保证）。 */
  entries: MarkdownDocument[]
  /** 手动重载（测试 / 失败恢复用）。 */
  reload: () => void
  /** 「打开文件夹」：系统对话框换根；返回新根（取消时 null）。 */
  chooseDirectory: () => Promise<string | null>
}

export function useFileTree(): FileTreeState {
  const [workDir, setWorkDir] = useState<string | null>(null)
  const [entries, setEntries] = useState<MarkdownDocument[]>([])
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchedDirRef = useRef<string | null>(null)

  const load = useCallback(async (root: string): Promise<void> => {
    const bridge = window.api
    if (!bridge?.fs?.listMarkdownDocuments) {
      console.error('[file-tree] window.api.fs.listMarkdownDocuments 不可用')
      return
    }
    try {
      const documents = await bridge.fs.listMarkdownDocuments({ rootPath: root })
      setEntries(documents)
    } catch (error) {
      // 失败可见：清空列表并留错误日志，不静默停在旧列表。
      console.error('[file-tree] 文档列表加载失败', error)
      setEntries([])
    }
  }, [])

  const reload = useCallback((): void => {
    if (!workDir) {
      return
    }
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current)
    }
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null
      void load(workDir)
    }, TREE_RELOAD_DEBOUNCE_MS)
  }, [workDir, load])

  const chooseDirectory = useCallback(async (): Promise<string | null> => {
    const bridge = window.api
    if (!bridge?.app?.chooseWorkDir) {
      console.error('[file-tree] window.api.app.chooseWorkDir 不可用（缺 preload 桥）')
      return null
    }
    const result = await bridge.app.chooseWorkDir()
    if (result.canceled || !result.workDir) {
      return null
    }
    // runtime-call 层（document-images 等落盘路径解析）跟随新根注册。
    await bridge.app.registerRuntimeWorktreeRoots?.({
      worktreeId: 'demo::local',
      rootPath: result.workDir
    })
    setWorkDir(result.workDir)
    return result.workDir
  }, [])

  // 初始根：主进程声明的第一个工作根。
  useEffect(() => {
    let disposed = false
    const start = async (): Promise<void> => {
      const bridge = window.api
      if (!bridge?.app?.getWorkDir) {
        console.error('[file-tree] window.api.app.getWorkDir 不可用（缺 preload 桥）')
        return
      }
      const { workDir: root } = await bridge.app.getWorkDir()
      if (!disposed) {
        setWorkDir(root)
      }
    }
    void start()
    return () => {
      disposed = true
    }
  }, [])

  // 根变化：重载列表 + 重新订阅 watch（旧订阅退订）。
  useEffect(() => {
    if (!workDir) {
      return
    }
    const bridge = window.api
    if (!bridge?.fs?.watchWorktree || !bridge.fs.onFsChanged) {
      console.error('[file-tree] window.api.fs watch 通道不可用（缺 preload 桥）')
      return
    }
    let disposed = false
    const unsubscribeFs = bridge.fs.onFsChanged((payload: FsChangedPayload) => {
      if (payload.worktreePath === workDir) {
        reload()
      }
    })
    void (async () => {
      try {
        // 旧根退订：换根后不再接收上一个目录的事件。
        const previous = watchedDirRef.current
        if (previous && previous !== workDir) {
          await bridge.fs.unwatchWorktree?.({ worktreePath: previous })
        }
        await bridge.fs.watchWorktree({ worktreePath: workDir })
        watchedDirRef.current = workDir
      } catch (error) {
        console.error('[file-tree] watch 订阅失败（列表仍可用，外部改动不刷新）', error)
      }
      if (!disposed) {
        await load(workDir)
      }
    })()
    return () => {
      disposed = true
      unsubscribeFs()
    }
  }, [workDir, load, reload])

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current)
      }
      const previous = watchedDirRef.current
      if (previous) {
        void window.api?.fs?.unwatchWorktree?.({ worktreePath: previous })
        watchedDirRef.current = null
      }
    }
  }, [])

  return { workDir, entries, reload, chooseDirectory }
}
