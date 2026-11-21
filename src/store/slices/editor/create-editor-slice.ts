// 精简版编辑器切片组合。与 Orca 原版（同名文件）的差异：
// 摘除 ./git/* 六个 creator 与 ./checks/check-run-details-actions —— git / check
// 差异视图不在本产品范围（PRD「不做」），其类型契约由 ./git/git-stubs.ts 以抛错桩补齐。
import { createEditorViewState } from './presentation/editor-view-state'
import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { EditorSlice } from './types/editor-slice'
import { createEditorDraftState } from './buffers/editor-draft-state'
import { createRightSidebarState } from '../right-sidebar/right-sidebar-state'
import { createExplorerDirState } from './explorer/explorer-dir-state'
import { createOpenFileState } from './opening/open-file-state'
import { createOpenFileAction } from './opening/open-file-action'
import { createMarkdownPreviewActions } from './markdown/markdown-preview-actions'
import { createPluginNewFileActions } from './opening/untitled-file-creation'
import { createCloseFileAction } from './closing/close-file-action'
import { createRecentlyClosedEditorTabs } from './closing/recently-closed-editor-tabs'
import { createOpenFileMutations } from './opening/open-file-mutations'
import { createRestoredEditorOwner } from './hydration/restored-editor-owner'
import { createRekeyOpenFilesAction } from './file-ids/rekey-open-files-action'
import { createEditorCursorLine } from './focus/editor-cursor-line'
import { createFileSearchActions } from './search/file-search-actions'
import { createEditorRevealFocusState } from './focus/editor-reveal-focus-state'
import { createMarkdownLinkAction } from './markdown/markdown-link-action'
import { createHydrateEditorSession } from './hydration/hydrate-editor-session'
import { createEditorBufferIdentityActions } from './buffers/editor-buffer-identity-actions'
import { createGitStubSlice } from './git/git-stubs'

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = (set, get) => ({
  ...createEditorDraftState(set),
  ...createEditorViewState(set, get),
  ...createRightSidebarState(set, get),
  ...createExplorerDirState(set, get),
  ...createOpenFileState(set, get),
  ...createOpenFileAction(set, get),
  ...createMarkdownPreviewActions(set, get),
  ...createPluginNewFileActions(set, get),
  ...createCloseFileAction(set, get),
  ...createRecentlyClosedEditorTabs(set, get),
  ...createOpenFileMutations(set, get),
  ...createRestoredEditorOwner(set, get),
  ...createRekeyOpenFilesAction(set, get),
  ...createEditorCursorLine(set, get),
  ...createFileSearchActions(set, get),
  ...createEditorRevealFocusState(set, get),
  ...createMarkdownLinkAction(set, get),
  ...createHydrateEditorSession(set, get),
  ...createEditorBufferIdentityActions(set, get),
  // git / check 成员：裁剪桩（调用即抛错），只为满足迁移件引用的类型契约。
  ...createGitStubSlice()
})
