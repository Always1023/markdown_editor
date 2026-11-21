// Git / check 差异视图的裁剪桩。Orca 的实现在 store/slices/editor/git/* 与
// checks/*（依赖 runtime 的 git RPC）；本产品不做 git 集成（PRD「不做」清单），
// 这些成员仅存在于 EditorGitSlice / EditorFilesSlice 类型契约中，迁移件的类型
// 引用需要它们。运行时进入即抛错——失败可见，不静默吞掉。
import type { StateCreator } from 'zustand'
import type { AppState } from '../../../types'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary,
  GitCommitCompareSummary
} from '@/shared/git/diff/git-diff-compare-types'
import type {
  GitBranchLineTotal,
  GitConflictKind,
  GitConflictOperation,
  GitStatusEntry,
  GitStatusResult,
  GitUpstreamStatus
} from '@/shared/git/status/git-status-types'
import type { CombinedDiffAlternate, ConflictReviewEntry, ConflictReviewState, OpenCheckRunDetailsState } from '@/shared/editor/views/editor-tab-view-types'
import type { GitPushTarget } from '@/shared/worktree/types'
import type {
  BranchCompareLike,
  CommitCompareLike,
  EditorOpenTargetOptions,
  EditorTabSelection
} from '../types/open-file'
import type { CheckRunDetailsTabPatch } from '@/components/editor/check-details/actions/check-run-details-tab'
import type { RemoteOpKind } from '@/components/right-sidebar/source-control/review/source-control-primary-action-types'
import type { GitRuntimeOperationOptions } from '../types/git-runtime-operation'

const gitUnavailable = (action: string): never => {
  throw new Error(`[store] git 功能未包含在本产品中：${action}`)
}

/** EditorGitSlice 中 git 专属成员（搜索 / 揭示 / 光标 / 水合成员由各自 creator 提供）。 */
export type EditorGitStubState = {
  gitStatusByWorktree: Record<string, GitStatusEntry[]>
  gitStatusHeadByWorktree: Record<string, string>
  gitStatusHugeByWorktree: Record<string, { limit: number }>
  gitStatusReadErrorByWorktree: Record<string, string>
  gitBranchLineTotalByWorktree: Record<string, GitBranchLineTotal | null>
  gitIgnoredPathsByWorktree: Record<string, string[]>
  gitConflictOperationByWorktree: Record<string, GitConflictOperation>
  trackedConflictPathsByWorktree: Record<string, Record<string, GitConflictKind>>
  trackConflictPath: (worktreeId: string, path: string, conflictKind: GitConflictKind) => void
  setGitStatus: (worktreeId: string, status: GitStatusResult) => void
  setConflictOperation: (worktreeId: string, operation: GitConflictOperation) => void
  remoteStatusesByWorktree: Record<string, GitUpstreamStatus>
  setUpstreamStatus: (worktreeId: string, status: GitUpstreamStatus) => void
  isRemoteOperationActive: boolean
  remoteOperations: { worktreeId: string; kind: RemoteOpKind }[]
  beginRemoteOperation: (kind: RemoteOpKind, worktreeId: string) => () => void
  fetchUpstreamStatus: (
    worktreeId: string,
    worktreePath: string,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions
  ) => Promise<GitUpstreamStatus | null>
  pushBranch: (
    worktreeId: string,
    worktreePath: string,
    publish?: boolean,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions & { forceWithLease?: boolean }
  ) => Promise<void>
  pullBranch: (
    worktreeId: string,
    worktreePath: string,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions
  ) => Promise<void>
  fastForwardBranch: (
    worktreeId: string,
    worktreePath: string,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions
  ) => Promise<void>
  syncBranch: (
    worktreeId: string,
    worktreePath: string,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions
  ) => Promise<void>
  rebaseFromBase: (
    worktreeId: string,
    worktreePath: string,
    baseRef: string,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions
  ) => Promise<void>
  fetchBranch: (
    worktreeId: string,
    worktreePath: string,
    connectionId?: string,
    pushTarget?: GitPushTarget,
    options?: GitRuntimeOperationOptions
  ) => Promise<void>
  gitBranchChangesByWorktree: Record<string, GitBranchChangeEntry[]>
  gitBranchCompareSummaryByWorktree: Record<string, GitBranchCompareSummary | null>
  gitBranchCompareRequestKeyByWorktree: Record<string, string>
  gitBranchCompareRequestStatusHeadByWorktree: Record<string, string | null>
  beginGitBranchCompareRequest: (
    worktreeId: string,
    requestKey: string,
    baseRef: string,
    options?: { preserveExistingSummary?: boolean }
  ) => void
  setGitBranchCompareResult: (
    worktreeId: string,
    requestKey: string,
    result: { summary: GitBranchCompareSummary; entries: GitBranchChangeEntry[] }
  ) => void
  clearGitBranchCompare: (worktreeId: string) => void

  openDiff: (
    worktreeId: string,
    filePath: string,
    relativePath: string,
    language: string,
    staged: boolean,
    options?: EditorOpenTargetOptions & { selection?: EditorTabSelection; oldPath?: string }
  ) => void
  openBranchDiff: (
    worktreeId: string,
    worktreePath: string,
    entry: GitBranchChangeEntry,
    compare: BranchCompareLike,
    language: string,
    options?: EditorOpenTargetOptions
  ) => void
  openCommitDiff: (
    worktreeId: string,
    worktreePath: string,
    entry: GitBranchChangeEntry,
    compare: CommitCompareLike,
    language: string,
    options?: EditorOpenTargetOptions
  ) => void
  openAllDiffs: (
    worktreeId: string,
    worktreePath: string,
    alternate?: CombinedDiffAlternate,
    areaFilter?: string,
    entriesSnapshot?: GitStatusEntry[],
    options?: EditorOpenTargetOptions
  ) => void
  openConflictFile: (
    worktreeId: string,
    worktreePath: string,
    entry: GitStatusEntry,
    language: string,
    options?: EditorOpenTargetOptions
  ) => void
  openConflictReviewFile: (
    reviewFileId: string,
    worktreeId: string,
    worktreePath: string,
    entry: GitStatusEntry,
    language: string
  ) => void
  openConflictReview: (
    worktreeId: string,
    worktreePath: string,
    entries: ConflictReviewEntry[],
    source: ConflictReviewState['source'],
    options?: EditorOpenTargetOptions
  ) => void
  openCheckRunDetails: (
    worktreeId: string,
    contextKey: string,
    check: OpenCheckRunDetailsState['check'],
    state: CheckRunDetailsTabPatch
  ) => void
  patchOpenCheckRunDetails: (
    worktreeId: string,
    contextKey: string,
    check: OpenCheckRunDetailsState['check'],
    state: CheckRunDetailsTabPatch
  ) => void
  reloadOpenCheckRunDetailsTab: (fileId: string) => Promise<void>
  openBranchAllDiffs: (
    worktreeId: string,
    worktreePath: string,
    compare: GitBranchCompareSummary,
    alternate?: CombinedDiffAlternate,
    options?: EditorOpenTargetOptions
  ) => void
  openCommitAllDiffs: (
    worktreeId: string,
    worktreePath: string,
    compare: GitCommitCompareSummary,
    entries: GitBranchChangeEntry[],
    subject?: string,
    message?: string,
    options?: EditorOpenTargetOptions
  ) => void
}

const throwSync = (action: string) => () => gitUnavailable(action)
const throwAsync = (action: string) => async () => gitUnavailable(action)

export const createGitStubSlice = (): EditorGitStubState => ({
  gitStatusByWorktree: {},
  gitStatusHeadByWorktree: {},
  gitStatusHugeByWorktree: {},
  gitStatusReadErrorByWorktree: {},
  gitBranchLineTotalByWorktree: {},
  gitIgnoredPathsByWorktree: {},
  gitConflictOperationByWorktree: {},
  trackedConflictPathsByWorktree: {},
  trackConflictPath: throwSync('trackConflictPath'),
  setGitStatus: throwSync('setGitStatus'),
  setConflictOperation: throwSync('setConflictOperation'),
  remoteStatusesByWorktree: {},
  setUpstreamStatus: throwSync('setUpstreamStatus'),
  isRemoteOperationActive: false,
  remoteOperations: [],
  beginRemoteOperation: throwSync('beginRemoteOperation'),
  fetchUpstreamStatus: throwAsync('fetchUpstreamStatus'),
  pushBranch: throwAsync('pushBranch'),
  pullBranch: throwAsync('pullBranch'),
  fastForwardBranch: throwAsync('fastForwardBranch'),
  syncBranch: throwAsync('syncBranch'),
  rebaseFromBase: throwAsync('rebaseFromBase'),
  fetchBranch: throwAsync('fetchBranch'),
  gitBranchChangesByWorktree: {},
  gitBranchCompareSummaryByWorktree: {},
  gitBranchCompareRequestKeyByWorktree: {},
  gitBranchCompareRequestStatusHeadByWorktree: {},
  beginGitBranchCompareRequest: throwSync('beginGitBranchCompareRequest'),
  setGitBranchCompareResult: throwSync('setGitBranchCompareResult'),
  clearGitBranchCompare: throwSync('clearGitBranchCompare'),

  openDiff: throwSync('openDiff'),
  openBranchDiff: throwSync('openBranchDiff'),
  openCommitDiff: throwSync('openCommitDiff'),
  openAllDiffs: throwSync('openAllDiffs'),
  openConflictFile: throwSync('openConflictFile'),
  openConflictReviewFile: throwSync('openConflictReviewFile'),
  openConflictReview: throwSync('openConflictReview'),
  openCheckRunDetails: throwSync('openCheckRunDetails'),
  patchOpenCheckRunDetails: throwSync('patchOpenCheckRunDetails'),
  reloadOpenCheckRunDetailsTab: throwAsync('reloadOpenCheckRunDetailsTab'),
  openBranchAllDiffs: throwSync('openBranchAllDiffs'),
  openCommitAllDiffs: throwSync('openCommitAllDiffs')
})
