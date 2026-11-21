import { isProvenProcessExit } from '@/shared/terminal/pty/lifecycle/terminal-exit-cause'
import { isPtyDataHandlerShutdownPending } from '@/components/terminal-pane/pty-transport/shutdown/pty-shutdown-data-suspension.ts'
import { deferPtyShutdownExit } from '@/components/terminal-pane/pty-transport/shutdown/pty-shutdown-exit-deferral.ts'
import {
  retireTerminalNoticeLifetime,
  type TerminalNoticeLifetime
} from '@/components/terminal-pane/provider-notices/terminal-notice-lifetime.ts'

let isStoreShutdownPending: (ptyId: string) => boolean = () => false

export function registerTerminalNoticeShutdownReader(reader: (ptyId: string) => boolean): void {
  isStoreShutdownPending = reader
}

/** Snapshot before primary callbacks can settle shutdown or replace the binding. */
export function prepareTerminalNoticeExit(
  lifetime: TerminalNoticeLifetime | undefined,
  code: number,
  incarnationId?: string
): () => void {
  // Unstamped transport loss needs canonical final-removal evidence, not a current-ID guess.
  if (
    !lifetime ||
    !incarnationId ||
    lifetime.incarnationId !== incarnationId ||
    !isProvenProcessExit(code)
  ) {
    return () => {}
  }
  return prepareAcceptedTerminalNoticeExit(lifetime)
}

/** The canonical owner already accepted process death; shutdown still owns settlement. */
export function prepareAcceptedTerminalNoticeExit(
  lifetime: TerminalNoticeLifetime | undefined
): () => void {
  if (!lifetime || lifetime.retired) {
    return () => {}
  }
  const pending =
    isPtyDataHandlerShutdownPending(lifetime.ptyId) || isStoreShutdownPending(lifetime.ptyId)
  if (pending) {
    deferPtyShutdownExit(lifetime.ptyId, (settlement) => {
      if (settlement === 'committed') {
        retireTerminalNoticeLifetime(lifetime)
      }
    })
    return () => {}
  }
  return () => retireTerminalNoticeLifetime(lifetime)
}

/** Bind buffered-exit delivery to its original admitted contribution. */
export function captureTerminalNoticeExitHandler(
  lifetime: TerminalNoticeLifetime | undefined,
  handler: (code: number) => void
): (code: number, incarnationId?: string) => void {
  return (code, incarnationId) => {
    const finish = prepareTerminalNoticeExit(lifetime, code, incarnationId)
    try {
      handler(code)
    } finally {
      finish()
    }
  }
}
