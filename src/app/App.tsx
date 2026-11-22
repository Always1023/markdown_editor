import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import RichMarkdownEditor from '@/components/editor/rich-markdown/instance/RichMarkdownEditor'
import MarkdownPreview from '@/components/editor/markdown-preview/surface/MarkdownPreview'
import { attachEditorAutosaveController } from '@/components/editor/autosave/editor-autosave-controller'
import { setEditorDiskBaseline } from '@/components/editor/save/queue/editor-save-disk-precondition'
import { getDiskBaselineSignature } from '@/shared/file-write/disk-baseline-signature'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { FileTree } from '@/components/file-tree/FileTree'
import { useFileTree } from '@/components/file-tree/use-file-tree'
import { MarkdownModeSwitcher } from '@/components/editor/source-mode/MarkdownModeSwitcher'
import { TabBar, type TabItem } from '@/components/tab-bar/TabBar'
import { useAppStore } from '@/store/index'
import type { MarkdownViewMode } from '@/store/slices/editor/types/open-file'
import {
  DEMO_WORKTREE_ID,
  installDemoWorkspaceState,
  openWorkspaceFile,
  startDemoFileIo,
  updateDemoWorkspaceRoot,
  type WorkspaceFileController
} from './demo-file-io'

// I-013：source 模式经动态 import 挂 Monaco（AC-08 大依赖只走异步 chunk）。
const LazyMonacoSourceEditor = lazyWithRetry(
  () => import('@/components/editor/source-mode/MonacoSourceEditor')
)

// I-011 demo 外壳：左栏文件树（工作根 = MARKDOWN_EDITOR_ROOTS[0]，可「打开文件夹」
// 换根）+ 编辑区落在真实磁盘文件上。打开 / 保存 / 外部修改语义沿用 I-009 的装配链
// （save queue CAS + 自动保存 + 自写识别 + fs:changed 横幅）。
// 横幅为 demo 轻量版：全量 ExternalFileChangeBanner（比对对话框 / 撤销 toast /
// telemetry）牵入尚未接线的面板模块链，阶段 3 后续 issue 替换。

const DEMO_CONTENT = `# markdown_editor

把 Orca 验证过的编辑子系统抽成独立产品：怎么编辑都不重排你手写的格式。

## 列表

- 输入时格式不被重排
- 粘贴图片自动落盘
- 表格、代码块、任务列表

## 表格

| 特性 | 状态 |
| ---- | ---- |
| 富文本编辑 | 已迁移 |
| Markdown 往返 | 保真 |

## 代码

\`\`\`ts
const greeting = 'hello, markdown'
\`\`\`

> 引用一段话，试试**加粗**、*斜体*、\`行内代码\`。

## 任务

- [x] 编辑器迁移
- [x] 文件读写（阶段 2）
- [ ] 外壳（阶段 3）
`

export default function App(): React.JSX.Element {
  const tree = useFileTree()
  // 多文件态：fileId → controller（每文件的 fs 订阅 / saveNow）；active 是编辑区当前文件。
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const controllersRef = useRef<Map<string, WorkspaceFileController>>(new Map())
  const diskContentRef = useRef<Map<string, string>>(new Map())
  const activeFileIdRef = useRef<string | null>(null)

  const activeFile = useAppStore((s) =>
    activeFileId ? s.openFiles.find((candidate) => candidate.id === activeFileId) : undefined
  )
  const isDirty = useAppStore((s) =>
    activeFileId ? (s.openFiles.find((c) => c.id === activeFileId)?.isDirty ?? false) : false
  )

  const activate = useCallback((fileId: string): void => {
    const disk = diskContentRef.current.get(fileId)
    const draft = useAppStore.getState().editorDrafts[fileId]
    activeFileIdRef.current = fileId
    setActiveFileId(fileId)
    setContent(draft ?? disk ?? '')
  }, [])

  useEffect(() => {
    let disposed = false
    const start = async (): Promise<void> => {
      try {
        if (!window.api?.app?.getWorkDir) {
          console.error('[demo] preload 桥缺 getWorkDir；demo 文件 IO 未启动')
          return
        }
        const { workDir } = (await window.api.app.getWorkDir()) as { workDir: string }
        if (disposed) {
          return
        }
        installDemoWorkspaceState(useAppStore, workDir)
        const controller = await startDemoFileIo({
          store: useAppStore,
          workDir,
          demoContent: DEMO_CONTENT,
          // autosave 由 App 外壳全局挂一份：关闭首个标签不拆自动保存。
          attachAutosave: false,
          onExternalReload: (next) => {
            diskContentRef.current.set(controller.fileId, next)
            if (activeFileIdRef.current === controller.fileId) {
              setContent(next)
            }
          }
        })
        if (disposed) {
          controller.dispose()
          return
        }
        controllersRef.current.set(controller.fileId, controller)
        diskContentRef.current.set(controller.fileId, controller.content)
        activate(controller.fileId)
      } catch (error) {
        // 装配失败可见：停在「未启动」而不是白屏静默。
        console.error('[demo] 文件 IO 装配失败', error)
      }
    }
    void start()
    return () => {
      disposed = true
      for (const controller of controllersRef.current.values()) {
        controller.dispose()
      }
      controllersRef.current.clear()
    }
  }, [activate])

  // 自动保存全局一份（I-012）：随外壳生命周期，不随任何单个标签关闭拆除。
  useEffect(() => {
    const detach = attachEditorAutosaveController(useAppStore)
    return () => {
      detach()
    }
  }, [])

  // 文件树「打开文件」：已开即切换，未开走 openWorkspaceFile 装配。
  const openFromTree = useCallback(
    (filePath: string): void => {
      const existing = [...controllersRef.current.values()].find(
        (controller) =>
          controller.filePath.replace(/\\/g, '/').toLowerCase() ===
          filePath.replace(/\\/g, '/').toLowerCase()
      )
      if (existing) {
        activate(existing.fileId)
        return
      }
      void (async () => {
        try {
          if (!tree.workDir) {
            console.error('[demo] 工作根未就绪，无法打开文件')
            return
          }
          let fileId = ''
          const controller = await openWorkspaceFile({
            store: useAppStore,
            workDir: tree.workDir,
            filePath,
            onExternalReload: (next) => {
              diskContentRef.current.set(fileId, next)
              if (activeFileIdRef.current === fileId) {
                setContent(next)
              }
            }
          })
          fileId = controller.fileId
          controllersRef.current.set(fileId, controller)
          diskContentRef.current.set(fileId, controller.content)
          activate(fileId)
        } catch (error) {
          console.error('[demo] 打开文件失败', error)
        }
      })()
    },
    [tree.workDir, activate]
  )

  // 「打开文件夹」：对话框换根（hook 负责注册 + 重载 + 重新订阅），store 工作区路径跟随。
  const chooseDirectory = useCallback((): void => {
    void tree.chooseDirectory().then((root) => {
      if (root) {
        updateDemoWorkspaceRoot(useAppStore, root)
      }
    })
  }, [tree])

  // ---- 多标签（I-012）：openFiles → TabBar 投影；dirty 关闭走确认对话框 ----
  const openFiles = useAppStore((s) => s.openFiles)
  const tabs: TabItem[] = openFiles
    .filter((file) => file.worktreeId === DEMO_WORKTREE_ID)
    .map((file) => ({
      fileId: file.id,
      label: file.relativePath,
      isDirty: file.isDirty,
      isActive: file.id === activeFileId
    }))

  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)

  const performClose = useCallback(
    (fileId: string): void => {
      const controller = controllersRef.current.get(fileId)
      useAppStore.getState().closeFile(fileId)
      controller?.dispose()
      controllersRef.current.delete(fileId)
      diskContentRef.current.delete(fileId)
      if (activeFileIdRef.current === fileId) {
        const remaining = useAppStore.getState().openFiles.filter(
          (file) => file.worktreeId === DEMO_WORKTREE_ID
        )
        const next = remaining[remaining.length - 1]
        if (next) {
          activate(next.id)
        } else {
          activeFileIdRef.current = null
          setActiveFileId(null)
          setContent(null)
        }
      }
    },
    [activate]
  )

  const requestClose = useCallback(
    (fileId: string): void => {
      const file = useAppStore.getState().openFiles.find((candidate) => candidate.id === fileId)
      if (file?.isDirty) {
        // 有未保存编辑：先确认，不静默丢弃。
        setPendingCloseId(fileId)
        return
      }
      performClose(fileId)
    },
    [performClose]
  )

  const confirmCloseWithoutSaving = useCallback((): void => {
    if (pendingCloseId) {
      performClose(pendingCloseId)
    }
    setPendingCloseId(null)
  }, [pendingCloseId, performClose])

  const saveAndClose = useCallback((): void => {
    const fileId = pendingCloseId
    if (!fileId) {
      return
    }
    setPendingCloseId(null)
    const controller = controllersRef.current.get(fileId)
    void controller
      ?.saveNow()
      .then(() => {
        performClose(fileId)
      })
      .catch((error) => {
        // 保存被拒（如 CAS 基线过期已标外部修改）：标签保留，失败可见。
        console.error('[demo] 保存并关闭被拒', error)
      })
  }, [pendingCloseId, performClose])

  // ---- 三渲染模式（I-013）：store.markdownViewMode 按 fileId，缺省 rich ----
  const viewMode = useAppStore((s) =>
    activeFileId ? (s.markdownViewMode[activeFileId] ?? 'rich') : 'rich'
  )
  const selectMode = useCallback(
    (mode: MarkdownViewMode): void => {
      if (!activeFileIdRef.current) {
        return
      }
      useAppStore.getState().setMarkdownViewMode(activeFileIdRef.current, mode)
    },
    []
  )

  // 保存队列写盘成功后清 dirty；用 active 文件 isDirty 下降沿刷新顶栏的「已保存」时间。
  const prevDirtyRef = useRef(false)
  useEffect(() => {
    if (prevDirtyRef.current && !isDirty) {
      setSavedAt(new Date().toLocaleTimeString())
    }
    prevDirtyRef.current = isDirty
  }, [isDirty])

  // 横幅动作「保留我的编辑」：draft 原样保留，基线重盖到磁盘版本，标记清除。
  const keepMyEdits = (): void => {
    if (!activeFileId || !activeFile) {
      return
    }
    void window.api.fs
      .readFile({ filePath: activeFile.filePath })
      .then((read) => {
        if (read.isBinary) {
          return
        }
        const state = useAppStore.getState()
        setEditorDiskBaseline(state, activeFileId, getDiskBaselineSignature(read.content))
        state.setExternalMutation(activeFileId, null)
      })
      .catch((error) => console.error('[demo] 保留编辑重盖基线失败', error))
  }

  // 横幅动作「用磁盘版本」：丢弃草稿、重读磁盘、基线与标记同步。
  const useDiskVersion = (): void => {
    if (!activeFileId || !activeFile) {
      return
    }
    void window.api.fs
      .readFile({ filePath: activeFile.filePath })
      .then((read) => {
        if (read.isBinary) {
          return
        }
        const state = useAppStore.getState()
        state.clearEditorDraft(activeFileId)
        state.markFileDirty(activeFileId, false)
        setEditorDiskBaseline(state, activeFileId, getDiskBaselineSignature(read.content))
        state.setExternalMutation(activeFileId, null)
        diskContentRef.current.set(activeFileId, read.content)
        setContent(read.content)
      })
      .catch((error) => console.error('[demo] 重读磁盘失败', error))
  }

  const activeController = activeFileId ? controllersRef.current.get(activeFileId) : undefined

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
        <div className="font-medium">markdown_editor · demo</div>
        <div className="text-muted-foreground">
          {activeFile?.externalMutation === 'changed'
            ? '磁盘上有外部修改'
            : isDirty
              ? '有未保存修改（Ctrl+S 保存）'
              : savedAt
                ? `已保存 ${savedAt}`
                : '未修改'}
        </div>
      </div>
      {activeFile?.externalMutation === 'changed' && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs"
        >
          <span className="min-w-0 font-medium text-foreground">
            {isDirty
              ? '此文件在磁盘上已被外部修改。保留你的编辑或改用磁盘版本。'
              : '此文件在磁盘上已被外部修改。'}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {isDirty && (
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-1 hover:bg-muted"
                onClick={keepMyEdits}
              >
                保留我的编辑
              </button>
            )}
            <button
              type="button"
              className="rounded border border-border bg-background px-2 py-1 hover:bg-muted"
              onClick={useDiskVersion}
            >
              用磁盘版本
            </button>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-2">
            <span
              className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
              title={tree.workDir ?? ''}
            >
              {tree.workDir ? (tree.workDir.split(/[\\/]/).pop() ?? tree.workDir) : '…'}
            </span>
            <button
              type="button"
              className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
              onClick={chooseDirectory}
            >
              打开文件夹
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1">
            <FileTree
              entries={tree.entries}
              activePath={activeController?.filePath ?? null}
              onOpen={openFromTree}
            />
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-2 py-1">
            <span className="min-w-0 truncate text-xs text-muted-foreground" title={activeController?.filePath ?? ''}>
              {activeFile?.relativePath ?? ''}
            </span>
            <MarkdownModeSwitcher viewMode={viewMode} onSelectMode={selectMode} />
          </div>
          <TabBar tabs={tabs} onSelect={activate} onClose={requestClose} />
          {content !== null && activeController && activeFileId && viewMode === 'rich' && (
            <div className="min-h-0 flex-1">
              <RichMarkdownEditor
                key={activeFileId}
                fileId={activeFileId}
                viewStateId={activeFileId}
                content={content}
                filePath={activeController.filePath}
                worktreeId={DEMO_WORKTREE_ID}
                runtimeEnvironmentId={null}
                scrollCacheKey={activeFileId}
                onContentChange={(next) => {
                  setContent(next)
                  useAppStore.getState().setEditorDraft(activeFileId, next)
                  useAppStore
                    .getState()
                    .markFileDirty(activeFileId, next !== diskContentRef.current.get(activeFileId))
                }}
                onDirtyStateHint={() => {}}
                onSave={(next) => {
                  // Ctrl+S：进 save queue（CAS 基线过期会被拒并标记外部修改）。
                  void controllersRef.current
                    .get(activeFileId)
                    ?.saveNow()
                    .catch((error) => {
                      console.error('[demo] 保存被拒', error)
                    })
                  return next
                }}
              />
            </div>
          )}
          {content !== null && activeController && activeFileId && viewMode === 'source' && (
            <div className="min-h-0 flex-1" data-testid="source-editor-host">
              <Suspense
                fallback={<p className="px-3 py-2 text-xs text-muted-foreground">源码编辑器加载中…</p>}
              >
                <LazyMonacoSourceEditor
                  value={content}
                  onChange={(next) => {
                    setContent(next)
                    useAppStore.getState().setEditorDraft(activeFileId, next)
                    useAppStore
                      .getState()
                      .markFileDirty(activeFileId, next !== diskContentRef.current.get(activeFileId))
                  }}
                  onSave={() => {
                    void controllersRef.current
                      .get(activeFileId)
                      ?.saveNow()
                      .catch((error) => {
                        console.error('[demo] 保存被拒', error)
                      })
                  }}
                />
              </Suspense>
            </div>
          )}
          {content !== null && activeController && activeFileId && viewMode === 'preview' && (
            <div className="min-h-0 flex-1 overflow-auto" data-testid="preview-host">
              <MarkdownPreview
                content={content}
                filePath={activeController.filePath}
                scrollCacheKey={activeFileId}
              />
            </div>
          )}
        </div>
      </div>
      {pendingCloseId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="presentation"
          data-testid="close-confirm-backdrop"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="关闭标签确认"
            className="w-80 rounded-md border border-border bg-background p-4 shadow-lg"
          >
            <p className="text-sm font-medium">此文件有未保存的修改。</p>
            <p className="mt-1 text-xs text-muted-foreground">关闭前要保存吗？</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-1 text-sm hover:bg-muted"
                onClick={() => setPendingCloseId(null)}
              >
                取消
              </button>
              <button
                type="button"
                data-testid="close-confirm-save"
                className="rounded border border-border bg-background px-2 py-1 text-sm hover:bg-muted"
                onClick={saveAndClose}
              >
                保存并关闭
              </button>
              <button
                type="button"
                data-testid="close-confirm-discard"
                className="rounded bg-primary px-2 py-1 text-sm text-primary-foreground hover:opacity-90"
                onClick={confirmCloseWithoutSaving}
              >
                不保存关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
