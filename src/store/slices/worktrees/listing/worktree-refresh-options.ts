import type { ExecutionHostId } from '@/shared/execution-host/execution-host.ts'

export type WorktreeRefreshAllOptions = {
  hydrationPurge?: 'allow' | 'defer'
  visibilityOwnerHostId?: ExecutionHostId
}
