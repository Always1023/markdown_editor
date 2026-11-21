import type { Worktree } from '@/shared/worktree/types.ts'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '@/shared/execution-host/execution-host.ts'

export function isExecutionHostAliasForWorktree(
  executionHostId: ExecutionHostId,
  worktree: Pick<Worktree, 'hostId' | 'runtimeOwnerEnvironmentId'>
): boolean {
  const runtimeOwner = worktree.runtimeOwnerEnvironmentId?.trim()
  return (
    executionHostId === (worktree.hostId ?? LOCAL_EXECUTION_HOST_ID) ||
    Boolean(runtimeOwner && executionHostId === toRuntimeExecutionHostId(runtimeOwner))
  )
}
