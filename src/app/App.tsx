import { useEffect, useState } from 'react'
import RichMarkdownEditor from '@/components/editor/rich-markdown/instance/RichMarkdownEditor'
import { useAppStore } from '@/store/index'
import type { AppState } from '@/store/types'

// I-006 demo：把迁移来的 RichMarkdownEditor 挂上屏。文档内容在内存里（阶段 2 接
// FileService 后换成真实文件读写），工作区用一个本地假目录让 owner 派生走 'local' host。
const DEMO_WORKTREE_ID = 'demo::/demo'
const DEMO_FILE_PATH = '/demo/welcome.md'

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
- [ ] 文件读写（阶段 2）
- [ ] 外壳（阶段 3）
`

/** 注册 demo 工作区：编辑器的 owner / route 派生按 worktreesByRepo 解析。 */
function installDemoWorkspace(): void {
  useAppStore.setState({
    activeWorktreeId: DEMO_WORKTREE_ID,
    repos: [{ id: 'demo', path: '/demo', kind: 'git', executionHostId: 'local' }],
    worktreesByRepo: {
      demo: [{ id: DEMO_WORKTREE_ID, repoId: 'demo', path: '/demo', hostId: 'local', branch: '' }]
    }
  } as unknown as Partial<AppState>)
}

export default function App(): React.JSX.Element {
  const [content, setContent] = useState(DEMO_CONTENT)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    installDemoWorkspace()
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
        <div className="font-medium">markdown_editor · demo</div>
        <div className="text-muted-foreground">
          {dirty ? '有未保存修改（Ctrl+S 保存）' : savedAt ? `已保存 ${savedAt}` : '未修改'}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <RichMarkdownEditor
          fileId={DEMO_FILE_PATH}
          viewStateId={DEMO_FILE_PATH}
          content={content}
          filePath={DEMO_FILE_PATH}
          worktreeId={DEMO_WORKTREE_ID}
          runtimeEnvironmentId={null}
          scrollCacheKey={DEMO_FILE_PATH}
          onContentChange={(next) => {
            setContent(next)
            setDirty(true)
          }}
          onDirtyStateHint={setDirty}
          onSave={(next) => {
            // 阶段 2 接 FileService 写盘；demo 先落内存。
            setContent(next)
            setDirty(false)
            setSavedAt(new Date().toLocaleTimeString())
          }}
        />
      </div>
    </div>
  )
}
