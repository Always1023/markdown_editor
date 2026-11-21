// Apply pure layout commands synchronously so runtime arrival order remains authoritative.

import { clientLayoutCommand } from '@/shared/workspace-layout/client-views/workspace-layout-client-command.ts'
import {
  closeBrowserPage,
  openBrowserPage,
  replaceTabContent,
  setBrowserTabProfile
} from '@/shared/workspace-layout/commands/workspace-layout-browser-commands.ts'
import { applied, refuse, type Applied } from './commands/workspace-layout-command-steps'
import type {
  CommandOf,
  LayoutCommand,
  LayoutContext,
  RenameTabsCommand
} from './workspace-layout-command-types'
import {
  openAgentSessionTab,
  openRoomTab,
  openBrowserTab,
  openEditorTab
} from '@/shared/workspace-layout/commands/workspace-layout-content-commands.ts'
import {
  moveTab,
  openInNewGroup,
  setGroupRatios,
  splitGroup
} from '@/shared/workspace-layout/commands/workspace-layout-group-commands.ts'
import { renameEditorFiles } from '@/shared/workspace-layout/editor-tabs/workspace-layout-editor-rekey.ts'
import { openSimulatorTab } from '@/shared/workspace-layout/commands/workspace-layout-simulator-tab.ts'
import { updateLegacyPersistence } from '@/shared/workspace-layout/persistence/workspace-layout-legacy-persistence.ts'
import { runDroppedLeafStep } from '@/shared/workspace-layout/commands/workspace-layout-dropped-leaves.ts'
import type { WorkspaceLayoutModel } from './workspace-layout-model'
import {
  closePane,
  equalizePanes,
  movePane,
  movePaneToNewTab,
  renamePane,
  setPaneGrid,
  releasePaneTerminal,
  setPaneRatios,
  splitPane
} from '@/shared/workspace-layout/commands/workspace-layout-pane-commands.ts'
import { restartPane, sleep, startPane, wake } from '@/shared/workspace-layout/commands/workspace-layout-process-commands.ts'
import {
  closeTabs,
  createTerminalTab,
  promotePreviewTab,
  setChatPane,
  setTabProps
} from '@/shared/workspace-layout/commands/workspace-layout-tab-commands.ts'
import { renameTab } from '@/shared/workspace-layout/commands/workspace-layout-tab-rename.ts'
import { moveTabToWorkspace } from '@/shared/workspace-layout/editor-tabs/workspace-layout-workspace-move.ts'
import { applyDefaultTabs } from '@/shared/workspace-layout/commands/workspace-layout-default-tabs.ts'

const CREATES_WORKSPACE = new Set<LayoutCommand['type']>([
  'createTerminalTab',
  'openEditorTab',
  'openBrowserTab',
  'openAgentSessionTab',
  'openSimulatorTab',
  'openRoomTab'
])

export function renameTabCommandsOf(command: RenameTabsCommand): CommandOf<'renameTab'>[] {
  return command.renames.map(({ workspace, tabId, title, replaceExisting }) => ({
    type: 'renameTab',
    workspace,
    tabId,
    kind: command.kind,
    title,
    ...(replaceExisting ? { replaceExisting } : {})
  }))
}

export function applyLayoutCommand(
  model: WorkspaceLayoutModel,
  command: LayoutCommand,
  context: LayoutContext
): Applied {
  const result = applyCommand(
    model,
    clientLayoutCommand(model, command, context.visibility),
    context
  )
  if (!result.ok) {
    return result
  }
  const next = updateLegacyPersistence(model, result.model)
  return {
    ...result,
    model: context.droppedLeafReason
      ? runDroppedLeafStep(model, next, context.droppedLeafReason, context.now())
      : next
  }
}

function applyCommand(
  model: WorkspaceLayoutModel,
  command: LayoutCommand,
  context: LayoutContext
): Applied {
  if (command.type === 'setDefaultTabsApplied') {
    return setDefaultTabsApplied(model, command.workspace)
  }
  if (command.type === 'applyDefaultTabs') {
    return applyDefaultTabs(model, command, context, setDefaultTabsApplied)
  }
  if (!model.workspaces[command.workspace] && !CREATES_WORKSPACE.has(command.type)) {
    // Closing what is already gone is not an error (#10747).
    if (command.type === 'closeTabs') {
      return applied(model, { alreadyClosed: true, closed: command.tabIds, refused: [] })
    }
    return command.type === 'closePane'
      ? applied(model, { alreadyClosed: true })
      : refuse('workspace_not_found')
  }
  switch (command.type) {
    case 'createTerminalTab':
      return openInNewGroup(model, command, (next) => createTerminalTab(next, command, context))
    case 'splitPane':
      return splitPane(model, command, context)
    case 'closePane':
      return closePane(model, command)
    case 'closeTabs':
      return closeTabs(model, command, context)
    case 'moveTab':
      return moveTab(model, command, context)
    case 'splitGroup':
      return splitGroup(model, command, context)
    case 'setGroupRatios':
      return setGroupRatios(model, command)
    case 'setPaneRatios':
      return setPaneRatios(model, command)
    case 'movePane':
      return movePane(model, command)
    case 'equalizePanes':
      return equalizePanes(model, command)
    case 'movePaneToNewTab':
      return movePaneToNewTab(model, command, context)
    case 'renameTab':
      return renameTab(model, command)
    case 'renamePane':
      return renamePane(model, command)
    case 'setPaneGrid':
      return setPaneGrid(model, command)
    case 'releasePaneTerminal':
      return releasePaneTerminal(model, command)
    case 'setTabProps':
      return setTabProps(model, command)
    case 'setChatPane':
      return setChatPane(model, command)
    case 'openEditorTab':
      return openInNewGroup(model, command, (next) => openEditorTab(next, command, context))
    case 'openSimulatorTab':
      return openInNewGroup(model, command, (next) => openSimulatorTab(next, command, context))
    case 'promotePreviewTab':
      return promotePreviewTab(model, command)
    case 'moveTabToWorkspace':
      return moveTabToWorkspace(model, command, context)
    case 'renameEditorFiles':
      return renameEditorFiles(model, command)
    case 'openBrowserTab':
      return openInNewGroup(model, command, (next) => openBrowserTab(next, command, context))
    case 'openBrowserPage':
      return openBrowserPage(model, command)
    case 'closeBrowserPage':
      return closeBrowserPage(model, command)
    case 'replaceTabContent':
      return replaceTabContent(model, command)
    case 'setBrowserTabProfile':
      return setBrowserTabProfile(model, command)
    case 'openAgentSessionTab':
      return openInNewGroup(model, command, (next) => openAgentSessionTab(next, command, context))
    case 'openRoomTab':
      return openInNewGroup(model, command, (next) => openRoomTab(next, command, context))
    case 'startPane':
      return startPane(model, command, context)
    case 'restartPane':
      return restartPane(model, command)
    case 'sleep':
      return sleep(model, command)
    case 'wake':
      return wake(model, command)
  }
}

// A record, not a layout: a workspace with no tabs yet (zero templates) is marked, not created.
function setDefaultTabsApplied(model: WorkspaceLayoutModel, workspace: string): Applied {
  const marks = model.records.defaultTabsAppliedByWorkspace
  if (marks?.[workspace]) {
    return applied(model)
  }
  return applied({
    ...model,
    records: { ...model.records, defaultTabsAppliedByWorkspace: { ...marks, [workspace]: true } }
  })
}
