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
export function usePrimeActiveSessionTitle(sessionPath: string | null | undefined): string | null {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionPath) return

    let cancelled = false
    void callHostOr<PrimeSessionSummary[]>('list_prime_session_summaries', []).then((sessions) => {
      if (cancelled) return
      const match = sessions.find((session) => session.path === sessionPath)
      const trimmed = match?.title?.trim()
      setTitle(trimmed || null)
    })

    return () => {
      cancelled = true
    }
  }, [sessionPath])

  // No session, no title — the read above only ever runs for an attached
  // one, so a stale value from a session that just detached is discarded
  // here rather than by a synchronous setState in the effect body.
  return sessionPath ? title : null
}
