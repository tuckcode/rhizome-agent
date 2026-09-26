import { useEffect, useState } from 'react'
import { callHostOr } from '../lib/callHost'
import type { PrimeSessionSummary } from '../lib/primeSessionMeta'

/**
 * The attached session's own title, for the Chat header.
 *
 * `usePrimeHostStatus` polls the daemon's `get_state` and knows a session's
 * id and log path, never its title — that lives in the session-list read
 * (`list_prime_session_summaries`), which `PrimeSessionList` already loads
 * privately for its own rows. There is no shared cache between the two, so
 * this reads the same list a second time and keeps only the one row the
 * header needs — the same tradeoff `PrimeSessionList` itself already makes
 * each time it reopens.
 *
 * Returns `null` while there is no attached session, while the read is in
 * flight, or when the matched session has no title (a session before its
 * first user turn) — the caller falls back to its own "New chat" label.
 */
export function usePrimeActiveSessionTitle(
  sessionPath: string | null | undefined,
  /**
   * Re-read when this changes. ChatHome passes the host's `isStreaming`, so
   * a new chat picks up the title Prime gives it after its first turn.
   */
  refreshKey?: unknown,
): string | null {
  // Keyed by path: a title read for one session is never shown for another,
  // even for the moment between a switch and the next read resolving.
  const [read, setRead] = useState<{ path: string, title: string | null } | null>(null)

  useEffect(() => {
    if (!sessionPath) return

    let cancelled = false
    void callHostOr<PrimeSessionSummary[] | null>('list_prime_session_summaries', []).then((sessions) => {
      if (cancelled) return
      // A host (or a test mock) may answer null rather than a list.
      const match = Array.isArray(sessions) ? sessions.find((session) => session.path === sessionPath) : undefined
      setRead({ path: sessionPath, title: match?.title?.trim() || null })
    })

    return () => {
      cancelled = true
    }
  }, [sessionPath, refreshKey])

  return sessionPath && read?.path === sessionPath ? read.title : null
}
