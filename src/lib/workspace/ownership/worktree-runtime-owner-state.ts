import type { ExecutionHostId } from '@/shared/execution-host/execution-host.ts'
import type { FolderWorkspace } from '@/shared/folder-workspaces/folder-workspace-types.ts'
import type { GlobalSettings } from '@/shared/settings/global-settings-types.ts'
import type { ProjectGroup } from '@/shared/project/groups/project-group-types.ts'
import type { Repo } from '@/shared/repository/repo-types.ts'
import type { Worktree } from '@/shared/worktree/types.ts'

export type WorktreeRuntimeOwnerState = {
  repos?: readonly (Pick<Repo, 'id' | 'connectionId' | 'executionHostId'> &
    Partial<Pick<Repo, 'path' | 'projectGroupId'>>)[]
  settings?: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null
  worktreesByRepo?: Record<
    string,
    readonly Pick<Worktree, 'id' | 'repoId' | 'hostId' | 'runtimeOwnerEnvironmentId'>[]
  >
  detectedWorktreesByRepo?: Record<
    string,
    {
      worktrees: readonly Pick<Worktree, 'id' | 'repoId' | 'hostId' | 'runtimeOwnerEnvironmentId'>[]
    }
  >
  folderWorkspaces?: readonly (Pick<
    FolderWorkspace,
    'id' | 'projectGroupId' | 'connectionId' | 'executionHostId'
  > &
    Partial<Pick<FolderWorkspace, 'folderPath'>>)[]
  projectGroups?: readonly (Pick<ProjectGroup, 'id' | 'connectionId' | 'executionHostId'> &
    Partial<Pick<ProjectGroup, 'parentGroupId'>>)[]
  restoredRuntimeHostIdByWorkspaceSessionKey?: Record<string, ExecutionHostId>
  activeWorktreeId?: string | null
  activeWorkspaceExecutionHostId?: ExecutionHostId | null
  runtimeEnvironments?: readonly { id: string }[]
  runtimeEnvironmentCatalogHydrated?: boolean
  removedRuntimeEnvironmentIds?: ReadonlySet<string>
}
