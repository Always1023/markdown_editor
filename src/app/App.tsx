import { useEffect, useRef, useState } from 'react'
import RichMarkdownEditor from '@/components/editor/rich-markdown/instance/RichMarkdownEditor'
import { setEditorDiskBaseline } from '@/components/editor/save/queue/editor-save-disk-precondition'
import { getDiskBaselineSignature } from '@/shared/file-write/disk-baseline-signature'
import { useAppStore } from '@/store/index'
import {
  DEMO_WORKTREE_ID,
  installDemoWorkspaceState,
  startDemoFileIo,
  type DemoFileIoController
} from './demo-file-io'

// I-009 demo：编辑器落在真实磁盘文件上（工作目录的 welcome.md，缺失即创建）。
// 保存走迁移来的 save queue（writeIfUnchanged CAS + 自动保存 + 自写识别）；
// 外部修改经 fs:changed 触发横幅，不静默覆盖编辑缓冲。
// 横幅为 demo 轻量版：全量 ExternalFileChangeBanner（比对对话框 / 撤销 toast /
// telemetry）牵入尚未接线的面板模块链，阶段 3 外壳时替换。

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
  const [content, setContent] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const controllerRef = useRef<DemoFileIoController | null>(null)
  const diskContentRef = useRef('')

  const fileId = controllerRef.current?.fileId ?? null
  const demoFile = useAppStore((s) =>
    fileId ? s.openFiles.find((candidate) => candidate.id === fileId) : undefined
  )
  const isDirty = useAppStore((s) =>
    fileId ? (s.openFiles.find((candidate) => candidate.id === fileId)?.isDirty ?? false) : false
  )

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
          onExternalReload: (next) => {
            diskContentRef.current = next
            setContent(next)
          }
        })
        if (disposed) {
          controller.dispose()
          return
        }
        controllerRef.current = controller
        diskContentRef.current = controller.content
        setContent(controller.content)
      } catch (error) {
        // 装配失败可见：停在「未启动」而不是白屏静默。
        console.error('[demo] 文件 IO 装配失败', error)
      }
    }
    void start()
    return () => {
      disposed = true
      controllerRef.current?.dispose()
      controllerRef.current = null
    }
  }, [])

  // 保存队列写盘成功后清 dirty；用 isDirty 下降沿刷新顶栏的「已保存」时间。
  const prevDirtyRef = useRef(false)
  useEffect(() => {
    if (prevDirtyRef.current && !isDirty) {
      setSavedAt(new Date().toLocaleTimeString())
    }
    prevDirtyRef.current = isDirty
  }, [isDirty])

  // 横幅动作「保留我的编辑」：draft 原样保留，基线重盖到磁盘版本，标记清除。
  // （与迁移的 keepTabEditsOverExternalChange 同语义的最小面：无 restamp 竞态
  // 跟踪 / undo toast——demo 单文件下读盘即重盖，阶段 3 换全量件。）
  const keepMyEdits = (): void => {
    if (!fileId || !demoFile) {
      return
    }
    void window.api.fs
      .readFile({ filePath: demoFile.filePath })
      .then((read) => {
        if (read.isBinary) {
          return
        }
        const state = useAppStore.getState()
        setEditorDiskBaseline(state, fileId, getDiskBaselineSignature(read.content))
        state.setExternalMutation(fileId, null)
      })
      .catch((error) => console.error('[demo] 保留编辑重盖基线失败', error))
  }

  // 横幅动作「用磁盘版本」：丢弃草稿、重读磁盘、基线与标记同步。
  const useDiskVersion = (): void => {
    if (!fileId || !demoFile) {
      return
    }
    void window.api.fs
      .readFile({ filePath: demoFile.filePath })
      .then((read) => {
        if (read.isBinary) {
          return
        }
        const state = useAppStore.getState()
        state.clearEditorDraft(fileId)
        state.markFileDirty(fileId, false)
        setEditorDiskBaseline(state, fileId, getDiskBaselineSignature(read.content))
        state.setExternalMutation(fileId, null)
        diskContentRef.current = read.content
        setContent(read.content)
      })
      .catch((error) => console.error('[demo] 重读磁盘失败', error))
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
        <div className="font-medium">markdown_editor · demo</div>
        <div className="text-muted-foreground">
          {demoFile?.externalMutation === 'changed'
            ? '磁盘上有外部修改'
            : isDirty
              ? '有未保存修改（Ctrl+S 保存）'
              : savedAt
                ? `已保存 ${savedAt}`
                : '未修改'}
        </div>
      </div>
      {demoFile?.externalMutation === 'changed' && (
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
      <div className="min-h-0 flex-1">
        {content !== null && controllerRef.current && (
          <RichMarkdownEditor
            fileId={controllerRef.current.fileId}
            viewStateId={controllerRef.current.fileId}
            content={content}
            filePath={controllerRef.current.filePath}
            worktreeId={DEMO_WORKTREE_ID}
            runtimeEnvironmentId={null}
            scrollCacheKey={controllerRef.current.fileId}
            onContentChange={(next) => {
              setContent(next)
              useAppStore.getState().setEditorDraft(controllerRef.current!.fileId, next)
              useAppStore
                .getState()
                .markFileDirty(controllerRef.current!.fileId, next !== diskContentRef.current)
            }}
            onDirtyStateHint={() => {}}
            onSave={(next) => {
              // Ctrl+S：进 save queue（CAS 基线过期会被拒并标记外部修改）。
              void controllerRef.current?.saveNow().catch((error) => {
                console.error('[demo] 保存被拒', error)
              })
              return next
            }}
          />
        )}
      </div>
    </div>
  )
}
