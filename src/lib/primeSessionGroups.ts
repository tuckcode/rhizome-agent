/**
 * Grouping Prime sessions for the session list.
 *
 * Mirrors `PrimeSessionSummary` in `src-tauri/src/prime_sessions.rs`. Kept as a
 * pure module with `now` passed in so the boundaries are testable — a grouping
 * that reads the clock itself can only be tested on the day it is written.
 */

export interface PrimeSessionSummary {
  id: string
  path: string
  title?: string | null
  cwd?: string | null
  startedAt?: string | null
  gitBranch?: string | null
  mtimeMs?: number | null
}

/**
 * `undated` is last on purpose: a session whose mtime could not be read is
 * still a real conversation, and dropping it would hide someone's work over a
 * filesystem quirk.
 */
export type PrimeSessionGroupKey = 'today' | 'yesterday' | 'week' | 'earlier' | 'undated'

export interface PrimeSessionGroup {
  key: PrimeSessionGroupKey
  sessions: PrimeSessionSummary[]
}

const GROUP_ORDER: PrimeSessionGroupKey[] = ['today', 'yesterday', 'week', 'earlier', 'undated']

const DAY_MS = 24 * 60 * 60 * 1000

/** Local midnight starting the day that contains `timestamp`. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Which group a session belongs to.
 *
 * Today and yesterday are decided on the *calendar* day, not a rolling 24
 * hours: 23:30 and 00:30 are an hour apart but belong under different
 * headings, and anyone working late would catch the lie immediately.
 */
function groupKeyFor(session: PrimeSessionSummary, now: number): PrimeSessionGroupKey {
  const timestamp = session.mtimeMs
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'undated'

  const today = startOfDay(now)
  if (timestamp >= today) return 'today'
  if (timestamp >= today - DAY_MS) return 'yesterday'
  if (timestamp >= today - 7 * DAY_MS) return 'week'
  return 'earlier'
}

/**
 * Short "when" label for a session row.
 *
 * The design system's session item carries a meta line (`Prime · 2m ago`), so
 * this is the time half of it. Coarse on purpose: a list row answers "how
 * stale is this", not "at what second".
 */
export function relativeSessionTime(session: PrimeSessionSummary, now: number): string | null {
  const timestamp = session.mtimeMs
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null

  const elapsed = Math.max(0, now - timestamp)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/**
 * Group sessions for display, newest first within each group.
 *
 * Empty groups are omitted rather than rendered as bare headings.
 */
export function groupPrimeSessions(
  sessions: PrimeSessionSummary[],
  now: number,
): PrimeSessionGroup[] {
  const buckets = new Map<PrimeSessionGroupKey, PrimeSessionSummary[]>()

  for (const session of sessions) {
    const key = groupKeyFor(session, now)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(session)
    else buckets.set(key, [session])
  }

  return GROUP_ORDER.flatMap((key) => {
    const bucket = buckets.get(key)
    if (!bucket?.length) return []
    const sessions = [...bucket].sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0))
    return [{ key, sessions }]
  })
}
