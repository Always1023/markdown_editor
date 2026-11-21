// 精简版 preload 类型面。Orca 原版（src/preload/api-types.ts）聚合 90+ 个 API 组；
// 本产品只保留渲染端实际触达的面（按 window.api.* 使用盘点）：fs / ui / shell /
// runtime(runtimeEnvironments) / localhostWorktreeLabels / export / e2e / app。
// 各面的成员类型原样来自 Orca 的对应文件，未裁剪成员——实现端（electron/preload）
// 按需接线，未接线的调用在运行时抛错，失败可见。
import type { ExportApi, FilesystemApi } from './api/filesystem/filesystem-api'
import type { UiWindowApi } from './api/window-ui/ui-window-api'
import type { UiCommandEventApi } from './api/window-ui/ui-command-event-api'
import type { DashboardApi } from './api/window-ui/dashboard-api'
import type { ShellApi } from './api/terminal/shell-api'
import type { PtyApi } from './api/terminal/pty-api'
import type { RuntimeApi } from './api/runtime/runtime-api'
import type { AppApi, E2EApi, PlatformApi } from './api/app-api'
import type {
  LocalhostWorktreeLabelResult,
  LocalhostWorktreeLabelRoute
} from '@/shared/workspace/ports/localhost-worktree-labels'
import type { EditorSaveHookDecision } from '@/shared/plugins/events/plugin-editor-save-hook'
import type { PluginHostCallOutcome } from '@/shared/plugins/frames/plugin-protocol'
import type { CrashReportsApi } from './api/diagnostics/crash-report-api'
import type { FolderWorkspacesApi, WorktreeApi } from './api/workspaces/worktree-api'

export type LocalhostWorktreeLabelsApi = {
  register: (args: LocalhostWorktreeLabelRoute) => Promise<LocalhostWorktreeLabelResult>
}

/** 插件宿主面：本产品不加载插件，保存钩子通道保持可选（未实现即跳过）。
 *  loadSyntax 与 Orca 签名一致（preload 未接线时运行时抛错，失败可见）。 */
export type PluginsApi = {
  editorSaveHook?: (event: {
    workspaceId: string | null
    path: string
    languageId?: string
    text: string
  }) => Promise<EditorSaveHookDecision>
  loadSyntax: (id: string) => Promise<unknown>
  panelAction?: (call: {
    sessionToken: string
    action: string
    params?: unknown
  }) => Promise<PluginHostCallOutcome>
  readNewFileTemplate?: (args: {
    pluginKey: string
    newFileId: string
  }) => Promise<string | null>
}

// 键形与 Orca 一致（迁移件按 window.api.fs.writeFile 这类扁平路径调用）：
// fs / runtime / runtimeEnvironments 取子面，ui 合并 UiWindowApi 与命令事件面。
export type PreloadApi = {
  app: AppApi
  platform: PlatformApi
  e2e: E2EApi
  fs: FilesystemApi['fs']
  notebook: FilesystemApi['notebook']
  // 工作区目录面：类型取 Orca 原样（diff 批注持久化按 folderWorkspaces / worktrees 写盘）；
  // electron/preload 未接线，运行时触达即失败可见（与 pty 同一约定）。
  folderWorkspaces: FolderWorkspacesApi
  worktrees: WorktreeApi
  export: ExportApi
  ui: UiWindowApi & UiCommandEventApi
  dashboard: DashboardApi
  shell: ShellApi
  // 终端 PTY 传输面：类型取 Orca 原样；electron/preload 未接线，运行时触达即失败可见
  // （本地形态无终端页签，代码只在有 pty 时才走到这些通道）。
  pty: PtyApi
  runtime: RuntimeApi['runtime']
  runtimeEnvironments: RuntimeApi['runtimeEnvironments']
  localhostWorktreeLabels: LocalhostWorktreeLabelsApi
  plugins: PluginsApi
  crashReports: CrashReportsApi
}

declare global {
  interface Window {
    api: PreloadApi
  }
}

export {}
