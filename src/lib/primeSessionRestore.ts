/**
 * Which conversation Chat should show at launch.
 *
 * Rehydrate (a live host session) and resume-last (an idle disk log) used to
 * be two hooks whose mutex lived in AiPanel. Callers had to know `reattached`,
 * `running`, `sessionPath`, and `isTauri`. A running host is not a Session
 * (ADR-0167: available is not active).
 *
 * The interface is: given host status and disk summaries, show this
 * conversation — or none.
 */

import { pickLastConversation, type PrimeSessionSummary } from './primeSessionMeta'

export type PrimeRestoreAction =
  | { type: 'none' }
  | { type: 'live-attach'; sessionPath: string }
  | { type: 'idle-disk'; session: PrimeSessionSummary }

export type PrimeRestoreInput = {
  enabled: boolean
  native: boolean
  hostRunning: boolean
  hostReattached: boolean
  hostSessionPath: string | null | undefined
  summaries: readonly PrimeSessionSummary[]
  idleResumeConsumed: boolean
}

function attachedSessionPath(input: Pick<PrimeRestoreInput, 'hostSessionPath'>): string {
  return input.hostSessionPath?.trim() || ''
}

/** Host is up, but no Session is showing. Disk may still hold the last chat. */
export function idleDiskRestoreEligible(input: Omit<PrimeRestoreInput, 'summaries'>): boolean {
  return input.enabled
    && input.native
    && input.hostRunning
    && !input.hostReattached
    && !attachedSessionPath(input)
    && !input.idleResumeConsumed
}

export function decidePrimeSessionRestore(input: PrimeRestoreInput): PrimeRestoreAction {
  if (!input.enabled) return { type: 'none' }

  const sessionPath = attachedSessionPath(input)
  if (input.hostReattached && sessionPath) {
    return { type: 'live-attach', sessionPath }
  }

  if (!idleDiskRestoreEligible(input)) return { type: 'none' }

  const last = pickLastConversation([...input.summaries])
  return last ? { type: 'idle-disk', session: last } : { type: 'none' }
}
