import type { WorktreeMeta } from '@/shared/worktree/meta-types.ts'
import type { DetectedWorktree, Worktree } from '@/shared/worktree/types.ts'

import type { ExecutionHostId } from '@/shared/execution-host/execution-host.ts'

export type WorktreeMetaUpdateGuard = (worktree: Worktree | DetectedWorktree | undefined) => boolean

export type WorktreeMetaUpdateOptions = {
  /** Required to mutate one row when the legacy locator exists on multiple hosts. */
  executionHostId?: ExecutionHostId
  shouldApply?: WorktreeMetaUpdateGuard
  /** Skip the automatic review refetch when the caller owns an equivalent refresh. */
  suppressHostedReviewRefresh?: boolean
}
export type WorktreeMetaBatchUpdate = {
  worktreeId: string
  updates: Partial<WorktreeMeta>
  executionHostId?: ExecutionHostId
}
