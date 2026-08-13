/**
 * Session-row labels for the Prime session list.
 *
 * Mirrors `PrimeSessionSummary` in `src-tauri/src/prime_sessions.rs`. Pure,
 * with `now` passed in, so the day boundaries are testable — a label that
 * reads the clock itself can only be tested on the day it was written.
 *
 * Shape follows Frame F of the design system: a flat list where each row
 * carries its own `Today · 14:08` / `Yesterday` / `Mon` meta, rather than
 * group headings above sections.
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

/** Coarse age, for analytics only — never rendered. */
export type PrimeSessionAge = 'today' | 'yesterday' | 'week' | 'older' | 'undated'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Local midnight starting the day that contains `timestamp`. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * How old a session is, in buckets.
 *
 * Today and yesterday are decided on the *calendar* day, not a rolling 24
 * hours: 23:30 and 00:30 are an hour apart but belong to different days, and
 * anyone working late would catch the lie immediately.
 */
export function primeSessionAge(session: PrimeSessionSummary, now: number): PrimeSessionAge {
  const timestamp = session.mtimeMs
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'undated'

  const today = startOfDay(now)
  if (timestamp >= today) return 'today'
  if (timestamp >= today - DAY_MS) return 'yesterday'
  if (timestamp >= today - 6 * DAY_MS) return 'week'
  return 'older'
}

function clockTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * The meta line under a session title.
 *
 * Per Frame F: `Today · 14:08`, `Yesterday`, `Mon`, else a short date. A
 * session mid-turn reads `Working · tools` instead — what it is doing now
 * matters more than when it last changed.
 */
export function primeSessionMetaLabel(
  session: PrimeSessionSummary,
  now: number,
  options: { working?: boolean } = {},
): string | null {
  if (options.working) return 'Working · tools'

  const timestamp = session.mtimeMs
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null

  switch (primeSessionAge(session, now)) {
    case 'today':
      return `Today · ${clockTime(timestamp)}`
    case 'yesterday':
      return 'Yesterday'
    case 'week':
      return WEEKDAYS[new Date(timestamp).getDay()]
    default: {
      const date = new Date(timestamp)
      return `${MONTHS[date.getMonth()]} ${date.getDate()}`
    }
  }
}

/** Newest first. Sessions with no timestamp sink to the bottom. */
export function sortPrimeSessions(sessions: PrimeSessionSummary[]): PrimeSessionSummary[] {
  return [...sessions].sort((a, b) => (b.mtimeMs ?? -Infinity) - (a.mtimeMs ?? -Infinity))
}
