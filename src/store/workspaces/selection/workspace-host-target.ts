import { selectWorktreesByRepo } from '../catalog/workspace-record-fields'
import type { QualifiedFolderHostState } from '@/shared/folder-workspaces/folder-workspace-execution-host.ts'
import type { Worktree } from '@/shared/worktree/types.ts'
import type { HostWorktreeTarget } from '@/shared/worktree/host-qualified-identity.ts'
import { parseWorkspaceKey } from '@/shared/workspace/identity/workspace-scope.ts'
import { findIndexedWorktreeOwnerForHost } from '../../../lib/workspace/ownership/worktree-runtime-owner-index'
import type { AppState } from '../../types'
import { getFolderWorkspaceWorktree } from '@/shared/folder-workspaces/folder-workspace-worktree.ts'
import { resolveQualifiedIndexedFolderWorkspace } from '@/store/folder-workspaces/folder-workspace-record-index.ts'

export type WorkspaceRecordState = Pick<AppState, 'worktreesByRepo' | 'folderWorkspaces'> &
  Pick<QualifiedFolderHostState, 'repos' | 'projectGroups'>

/**
 * The row that owns `target` on its host, including a paired runtime's logical host alias.
 * An ambiguous owner on that host answers undefined.
 */
export function selectWorkspaceByHostTarget(
  state: WorkspaceRecordState,
  target: HostWorktreeTarget
): Worktree | undefined {
  const scope = parseWorkspaceKey(target.id)
  if (scope?.type === 'folder') {
    const result = resolveQualifiedIndexedFolderWorkspace(
      state,
      scope.folderWorkspaceId,
      target.hostId
    )
    return result.kind === 'selected'
      ? getFolderWorkspaceWorktree(result.value.workspace, result.value)
      : undefined
  }
  return (
    findIndexedWorktreeOwnerForHost(selectWorktreesByRepo(state), target.id, target.hostId) ??
    undefined
  )
}
