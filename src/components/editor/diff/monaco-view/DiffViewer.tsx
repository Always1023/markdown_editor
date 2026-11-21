import { NO_RESOURCE_EVIDENCE } from '@/lib/workspace/ownership/workspace-copy-owner'
import { useDiffCommentView } from '../../../diff-comments/use-diff-comment-owner'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DiffEditor, type DiffOnMount } from '@monaco-editor/react'
import type { IDisposable, editor } from 'monaco-editor'
import { useAppStore } from '@/store/index'
import {
  diffViewStateCache,
  setWithLRU
} from '@/components/editor/model-lifetime/retention/editor-view-state-cache'
import { monacoTypographyOptions } from '@/lib/editor/appearance/editor-typography'
import { useEditorTypography } from '@/lib/editor/appearance/use-editor-typography'
import { useContextualCopySetup } from '@/components/editor/contextual-copy/useContextualCopySetup.tsx'
import { useDiffCommentDecorator } from '@/components/diff-comments/useDiffCommentDecorator.tsx'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import { applyDiffEditorLineNumberOptions } from '@/components/editor/diff/monaco-view/diff-editor-line-number-options.ts'
import { isDiffComment } from '@/lib/source-control/review/comments/diff-comment-compat'
import {
  installEditorSaveShortcut,
  installMonacoEditorFindShortcut
} from '../../commands/editor-shortcuts'
import { diffEditorScrollbarOptions } from '@/components/editor/diff/monaco-view/diff-editor-scrollbar-options.ts'
import { LargeDiffFallback } from '@/components/editor/diff/large-files/LargeDiffFallback.tsx'
import { getLargeDiffRenderLimit } from '@/shared/source-control/diff/large-diff-render-limit.ts'
import { useDiffViewerLargeDiffLifecycle } from '@/components/editor/diff/large-files/useDiffViewerLargeDiffLifecycle.ts'
import { useDiffViewerFirstChangeAutoScroll } from '@/components/editor/diff/monaco-view/useDiffViewerFirstChangeAutoScroll.ts'
import { getDiffViewerLargeDiffSaveAction } from '@/components/editor/diff/large-files/diff-viewer-large-diff-save-action.ts'
import type { DiffViewerProps } from '@/components/editor/diff/monaco-view/diff-viewer-props.ts'
import { buildDiffEditorWhitespaceOptions } from '@/components/editor/diff/monaco-view/diff-editor-whitespace-options.ts'
import {
  buildDiffEditorWordWrapOptions,
  syncDiffEditorOriginalWordWrap
} from '@/components/editor/diff/monaco-view/diff-editor-word-wrap-options.ts'
import { buildDiffEditorHideUnchangedOptions } from '@/components/editor/diff/monaco-view/diff-editor-hide-unchanged-options.ts'
import { restoreDiffViewStateWhileLayoutSettles } from '@/components/editor/diff/monaco-view/diff-view-state-restore.ts'
import { useDiffEditorRegistration } from '@/components/editor/diff/review/diff-navigation-context.tsx'
import { preserveDiffViewStateAcrossModelSwaps } from '@/components/editor/diff/monaco-view/diff-model-swap-view-state.ts'
import { monacoFindOptions } from '@/components/editor/monaco/monaco-find-options.ts'
import { buildEditorUnicodeHighlightOptions } from '@/components/editor/monaco/editor-unicode-highlight-options.ts'
import { usePluginSyntaxLanguage } from '@/components/editor/monaco/use-plugin-syntax-language.ts'
import {
  PLUGIN_SYNTAX_EDITOR_OPTIONS,
  applyModelLanguage
} from '@/lib/monaco-languages/plugin-syntax-editor-options'
import { useMonacoTheme } from '@/lib/editor/appearance/use-monaco-theme'
import { cn } from '@/lib/class-names'
import { wholeFileDiffTintClass } from '@/components/editor/diff/monaco-view/whole-file-diff-tint.ts'
import { syncKeptDiffModelsOnMount } from '@/components/editor/diff/monaco-view/diff-kept-model-content-sync.ts'

export default function DiffViewer({
  modelKey,
  modelOwnerKey,
  originalModelKey,
  modifiedModelKey,
  originalContent,
  modifiedContent,
  language: coreLanguage,
  filePath,
  relativePath,
  sideBySide,
  editable,
  worktreeId,
  noteSource = NO_RESOURCE_EVIDENCE,
  onAddLineComment,
  commentableLineNumbers,
  addLineCommentLabel,
  addLineCommentPlaceholder,
  onContentChange,
  onSave,
  largeDiffRenderLimit,
  largeDiffSaveContentAvailable
}: DiffViewerProps): React.JSX.Element {
  const t = useTranslate()
  const diffWordWrap = useAppStore((s) => s.settings?.diffWordWrap)
  const diffShowWhitespace = useAppStore((s) => s.settings?.diffShowWhitespace)
  const diffCollapseUnchangedRegions = useAppStore((s) => s.settings?.diffCollapseUnchangedRegions)
  const monacoTheme = useMonacoTheme()
  const diffTypography = useEditorTypography('diff')
  // One read: the stable notes array and the copy it belongs to; filter below so unrelated writes don't invalidate.
  const { owner: commentOwner, comments: allDiffComments } = useDiffCommentView(
    worktreeId,
    noteSource
  )
  const addDiffComment = useAppStore((s) => s.addDiffComment)
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment)
  const language = usePluginSyntaxLanguage(filePath, coreLanguage)
  const updateDiffComment = useAppStore((s) => s.updateDiffComment)
  const scrollToDiffCommentId = useAppStore((s) => s.scrollToDiffCommentId)
  const setScrollToDiffCommentId = useAppStore((s) => s.setScrollToDiffCommentId)
  const diffComments = useMemo(
    () => (allDiffComments ?? []).filter((c) => c.filePath === relativePath && isDiffComment(c)),
    [allDiffComments, relativePath]
  )

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const { registerDiffEditor, unregisterDiffEditor } = useDiffEditorRegistration()
  const lineNumberOptionsSubRef = useRef<{ dispose: () => void } | null>(null)
  const wordWrapOptionsSubRef = useRef<{ dispose: () => void } | null>(null)
  const wordWrapMountFrameRef = useRef(0)
  const diffWordWrapRef = useRef(diffWordWrap)
  useLayoutEffect(() => {
    diffWordWrapRef.current = diffWordWrap
  }, [diffWordWrap])
  const [modifiedEditor, setModifiedEditor] = useState<editor.ICodeEditor | null>(null)
  useEffect(() => {
    const models = diffEditorRef.current?.getModel()
    applyModelLanguage([models?.original, models?.modified], language)
  }, [modifiedEditor, language])

  const renderLimit = useMemo(
    () => largeDiffRenderLimit ?? getLargeDiffRenderLimit({ originalContent, modifiedContent }),
    [largeDiffRenderLimit, originalContent, modifiedContent]
  )
  const hasLineCommentAction = Boolean(worktreeId || onAddLineComment)

  // Forward only owned notes so viewers cannot race to acknowledge another surface’s request.
  const pendingScrollForThisViewer = useMemo(() => {
    if (!worktreeId || !scrollToDiffCommentId) {
      return null
    }
    return diffComments.some((c) => c.id === scrollToDiffCommentId) ? scrollToDiffCommentId : null
  }, [scrollToDiffCommentId, diffComments, worktreeId])

  // A draft keeps its captured owner across a same-tab rename but saves under the file's current path.
  const propsRef = useRef({ relativePath, language, onSave, originalContent, modifiedContent })
  useLayoutEffect(() => {
    propsRef.current = { relativePath, language, onSave, originalContent, modifiedContent }
  }, [relativePath, language, onSave, originalContent, modifiedContent])
  const handleCreateComment = useCallback(
    async ({
      lineNumber,
      startLine,
      body
    }: {
      lineNumber: number
      startLine?: number
      body: string
    }): Promise<boolean> => {
      if (onAddLineComment) {
        return onAddLineComment({
          lineNumber,
          startLine,
          body
        })
      }
      if (!worktreeId) {
        return false
      }
      const result = await (commentOwner
        ? addDiffComment(commentOwner, {
            worktreeId,
            filePath: propsRef.current.relativePath,
            source: 'diff',
            startLine,
            lineNumber,
            body,
            side: 'modified'
          })
        : null)
      if (!result) {
        toast.error(
          translate('auto.components.editor.diffCommentSaveFailed', 'Failed to save comment')
        )
      }
      return Boolean(result)
    },
    [commentOwner, addDiffComment, onAddLineComment, worktreeId]
  )

  // Only local diffs can edit notes; gate the decorator on a valid comment target.
  useDiffCommentDecorator({
    captureCreateComment: !onAddLineComment,
    commentOwner,
    editor: hasLineCommentAction ? modifiedEditor : null,
    monacoModelIdentity: modifiedModelKey ?? modelKey,
    filePath: relativePath,
    worktreeId: worktreeId ?? '',
    comments: worktreeId ? diffComments : [],
    commentableLineNumbers,
    addButtonLabel: addLineCommentLabel,
    addNoteShortcutEnabled: hasLineCommentAction,
    onCreateComment: handleCreateComment,
    draftPlaceholder: addLineCommentPlaceholder,
    draftSubmitLabel: addLineCommentLabel,
    // Notes of an unknown copy can't be added to; hosted review comments have no local copy.
    canOpenDraft: !renderLimit.limited && (commentOwner !== null || Boolean(onAddLineComment)),
    onDeleteComment: (id) => {
      if (worktreeId) {
        void (commentOwner && deleteDiffComment(commentOwner, id))
      }
    },
    onUpdateComment: worktreeId
      ? (id, body) =>
          commentOwner ? updateDiffComment(commentOwner, id, body) : Promise.resolve(false)
      : undefined,
    pendingScrollCommentId: pendingScrollForThisViewer,
    onPendingScrollConsumed: () => setScrollToDiffCommentId(null)
  })

  // Note navigation scrolls after the cached restore; end the settle window so it can't pull the view back.
  const viewStateRestoreRef = useRef<IDisposable | null>(null)
  useEffect(() => {
    if (pendingScrollForThisViewer) {
      viewStateRestoreRef.current?.dispose()
    }
  }, [pendingScrollForThisViewer, modifiedEditor])

  useDiffViewerFirstChangeAutoScroll({
    diffEditorRef,
    modifiedEditor,
    modelKey,
    pendingScrollCommentId: pendingScrollForThisViewer
  })

  const handleEnterLargeDiffFallback = useCallback(() => {
    // Fallback disposes Monaco; clear refs before decorators or save handlers can use them.
    lineNumberOptionsSubRef.current?.dispose()
    lineNumberOptionsSubRef.current = null
    cancelAnimationFrame(wordWrapMountFrameRef.current)
    wordWrapOptionsSubRef.current?.dispose()
    wordWrapOptionsSubRef.current = null
    viewStateRestoreRef.current = null
    // Capture the exact instance before clearing; unregister ignores stale identities.
    const fallenBackEditor = diffEditorRef.current
    diffEditorRef.current = null
    if (fallenBackEditor) {
      unregisterDiffEditor(fallenBackEditor)
    }
    setModifiedEditor(null)
  }, [unregisterDiffEditor])

  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange

  const { setupCopy, toastNode } = useContextualCopySetup()

  const currentDiffModelPaths = useDiffViewerLargeDiffLifecycle({
    limited: renderLimit.limited,
    modelKey,
    modelOwnerKey,
    originalModelKey,
    modifiedModelKey,
    diffEditorRef,
    onEnterFallback: handleEnterLargeDiffFallback
  })

  const handleMount: DiffOnMount = useCallback(
    (diffEditor, monaco) => {
      diffEditorRef.current = diffEditor
      registerDiffEditor(diffEditor)
      // Monaco applies its inline wrap override after mount when width is known.
      wordWrapMountFrameRef.current = requestAnimationFrame(() => {
        if (diffEditorRef.current !== diffEditor) {
          return
        }
        wordWrapOptionsSubRef.current?.dispose()
        wordWrapOptionsSubRef.current = syncDiffEditorOriginalWordWrap(
          diffEditor,
          diffWordWrapRef.current
        )
      })
      lineNumberOptionsSubRef.current?.dispose()
      lineNumberOptionsSubRef.current = applyDiffEditorLineNumberOptions(diffEditor, sideBySide)

      const originalEditor = diffEditor.getOriginalEditor()
      const modifiedEditor = diffEditor.getModifiedEditor()
      modifiedEditor.onDidDispose(() => {
        if (diffEditorRef.current !== diffEditor) {
          return
        }
        cancelAnimationFrame(wordWrapMountFrameRef.current)
        lineNumberOptionsSubRef.current?.dispose()
        lineNumberOptionsSubRef.current = null
        wordWrapOptionsSubRef.current?.dispose()
        wordWrapOptionsSubRef.current = null
        viewStateRestoreRef.current = null
        unregisterDiffEditor(diffEditor)
        diffEditorRef.current = null
        setModifiedEditor(null)
      })
      diffEditor.onDidDispose(preserveDiffViewStateAcrossModelSwaps(diffEditor).dispose)
      // Before the content listener attaches, so reconciling never reads as a user edit.
      syncKeptDiffModelsOnMount(diffEditor, propsRef)

      setupCopy(originalEditor, monaco, filePath, propsRef)
      setupCopy(modifiedEditor, monaco, filePath, propsRef)
      setModifiedEditor(modifiedEditor)

      // Restore cursor and selection across both panes alongside scroll.
      const savedViewState = diffViewStateCache.get(modelKey)
      viewStateRestoreRef.current = savedViewState
        ? restoreDiffViewStateWhileLayoutSettles(diffEditor, savedViewState)
        : null
      // Auto-scroll runs separately after decorator view zones mount.

      if (editable) {
        const cleanupSaveShortcut = installEditorSaveShortcut(
          modifiedEditor.getContainerDomNode(),
          () => {
            onSaveRef.current?.(modifiedEditor.getValue())
          }
        )
        const cleanupOriginalFindShortcut = installMonacoEditorFindShortcut(originalEditor)
        const cleanupModifiedFindShortcut = installMonacoEditorFindShortcut(modifiedEditor)

        const modelContentSub = modifiedEditor.onDidChangeModelContent(() => {
          onContentChangeRef.current?.(modifiedEditor.getValue())
        })
        modifiedEditor.onDidDispose(() => {
          // Shortcut bridges and model subscriptions belong to this diff instance.
          cleanupSaveShortcut()
          cleanupOriginalFindShortcut()
          cleanupModifiedFindShortcut()
          modelContentSub.dispose()
        })

        modifiedEditor.focus()
      } else {
        diffEditor.focus()
      }
    },
    [editable, setupCopy, modelKey, filePath, sideBySide, registerDiffEditor, unregisterDiffEditor]
  )

  // Snapshot on layout cleanup before unmount, avoiding scroll-time writes.
  useLayoutEffect(() => {
    return () => {
      const de = diffEditorRef.current
      if (de) {
        const currentViewState = de.saveViewState()
        if (currentViewState) {
          setWithLRU(diffViewStateCache, modelKey, currentViewState)
        }
      }
    }
  }, [modelKey])

  useEffect(() => {
    cancelAnimationFrame(wordWrapMountFrameRef.current)
    const diffEditor = diffEditorRef.current
    if (!diffEditor) {
      return () => {
        cancelAnimationFrame(wordWrapMountFrameRef.current)
      }
    }
    lineNumberOptionsSubRef.current?.dispose()
    lineNumberOptionsSubRef.current = applyDiffEditorLineNumberOptions(diffEditor, sideBySide)
    wordWrapOptionsSubRef.current?.dispose()
    wordWrapOptionsSubRef.current = syncDiffEditorOriginalWordWrap(diffEditor, diffWordWrap)
    return () => {
      cancelAnimationFrame(wordWrapMountFrameRef.current)
      lineNumberOptionsSubRef.current?.dispose()
      lineNumberOptionsSubRef.current = null
      wordWrapOptionsSubRef.current?.dispose()
      wordWrapOptionsSubRef.current = null
    }
  }, [diffWordWrap, sideBySide])

  // Why: @monaco-editor/react calls updateOptions whenever this object's identity changes.
  const editorOptions = useMemo<editor.IDiffEditorConstructionOptions>(
    () => ({
      dropIntoEditor: { enabled: false },
      readOnly: !editable,
      originalEditable: false,
      renderSideBySide: sideBySide,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      ...PLUGIN_SYNTAX_EDITOR_OPTIONS,
      ...monacoTypographyOptions(diffTypography),
      lineNumbers: 'on',
      ...buildDiffEditorWordWrapOptions(diffWordWrap),
      ...buildDiffEditorWhitespaceOptions(diffShowWhitespace),
      ...buildDiffEditorHideUnchangedOptions(diffCollapseUnchangedRegions),
      automaticLayout: true,
      renderOverviewRuler: true,
      scrollbar: diffEditorScrollbarOptions,
      padding: { top: 0 },
      find: monacoFindOptions,
      unicodeHighlight: buildEditorUnicodeHighlightOptions(language)
    }),
    [
      language,
      editable,
      sideBySide,
      diffTypography,
      diffWordWrap,
      diffShowWhitespace,
      diffCollapseUnchangedRegions
    ]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 relative">
        {renderLimit.limited ? (
          <LargeDiffFallback
            filePath={relativePath}
            renderLimit={renderLimit}
            action={getDiffViewerLargeDiffSaveAction(
              {
                editable,
                modifiedContent,
                onSave,
                saveContentAvailable: largeDiffSaveContentAvailable
              },
              t
            )}
          />
        ) : (
          <DiffEditor
            height="100%"
            // Why: the overview ruler column is unpainted; it shows this surface, not the app's.
            className={cn(
              'code-editor-backdrop',
              wholeFileDiffTintClass(originalContent, modifiedContent)
            )}
            language={language}
            original={originalContent}
            modified={modifiedContent}
            theme={monacoTheme}
            onMount={handleMount}
            // Tab-owned models preserve modified undo across Changes-mode HEAD rotations.
            originalModelPath={currentDiffModelPaths.originalModelPath}
            modifiedModelPath={currentDiffModelPaths.modifiedModelPath}
            keepCurrentOriginalModel
            keepCurrentModifiedModel
            options={editorOptions}
          />
        )}
      </div>
      {toastNode}
    </div>
  )
}
