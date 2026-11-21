import type {
  TerminalLayoutSnapshot,
  TerminalTab
} from '@/shared/workspace-layout/terminal-tab-types.ts'
import type { WorkspaceSessionState } from '@/shared/workspace-session/workspace-session-state-types.ts'
import { releaseTerminalLayoutPtyIds } from '@/store/terminals/hydration/terminal-session-row-hydration.ts'
import { normalizeTerminalLayoutSnapshot } from '../../../components/terminal-pane/layout/terminal-layout-normalization'
import { resolvePtyBoundActiveLeafId } from '../../../components/terminal-pane/layout/ownership/terminal-layout-active-leaf'
import { resolveTerminalLayoutPtyOwnershipTransfers } from '@/shared/workspace-layout/terminal-topology/terminal-layout-pty-ownership.ts'
import { sanitizeTerminalLayoutPaneTitles } from '@/shared/workspace-layout/terminal-topology/terminal-pane-title-sanitization.ts'
import type { TerminalLayoutPtyOwnershipTransfer } from '@/store/terminals/hydration/workspace-terminal-hydration-patch.ts'

export function buildWorkspaceTerminalLayoutPlan({
  ownershipTransfersByTabId,
  ownershipTransferTabIds,
  releasedPtyIdsByTabId,
  session,
  tabById,
  validTabIds
}: {
  ownershipTransfersByTabId: Map<string, TerminalLayoutPtyOwnershipTransfer[]>
  ownershipTransferTabIds: ReadonlySet<string> | null
  releasedPtyIdsByTabId: ReadonlyMap<string, ReadonlySet<string>>
  session: WorkspaceSessionState
  tabById: ReadonlyMap<string, TerminalTab>
  validTabIds: ReadonlySet<string>
}): Record<string, TerminalLayoutSnapshot> {
  return Object.fromEntries(
    Object.entries(session.terminalLayoutsByTabId)
      .filter(([tabId]) => validTabIds.has(tabId))
      .map(([tabId, persisted]) => {
        const releasedPtyIds = releasedPtyIdsByTabId.get(tabId)
        const layout = releasedPtyIds
          ? releaseTerminalLayoutPtyIds(persisted, releasedPtyIds)
          : persisted
        const normalization = normalizeTerminalLayoutSnapshot(layout)
        const normalized = normalization.snapshot
        if (
          normalization.changed &&
          (!ownershipTransferTabIds || ownershipTransferTabIds.has(tabId))
        ) {
          ownershipTransfersByTabId.set(
            tabId,
            resolveTerminalLayoutPtyOwnershipTransfers(layout, normalized)
          )
        }
        const tab = tabById.get(tabId)
        const sanitized = tab ? sanitizeTerminalLayoutPaneTitles(normalized, tab) : normalized
        const activeLeafId = sanitized.root
          ? resolvePtyBoundActiveLeafId({
              root: sanitized.root,
              activeLeafId: sanitized.activeLeafId,
              ptyIdsByLeafId: sanitized.ptyIdsByLeafId
            })
          : sanitized.activeLeafId
        return [tabId, { ...sanitized, activeLeafId }]
      })
  )
}
