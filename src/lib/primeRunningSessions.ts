/**
 * Turns Prime's daemon session roster into the compact "what is running" list
 * the menu-bar companion shows beneath quick capture (#13).
 *
 * Pure — no Tauri, no I/O, no clock. The roster arrives from the daemon's
 * `list` command via `prime_running_sessions`.
 *
 * ## Why these fields and not the ones the types advertise
 *
 * Probed live against `prime-agent` 0.7.2 (daemon protocol 7) rather than read
 * off `daemon-session-list.d.ts`, because the two disagree in ways that matter:
 *
 * - **`sessionName` is never present.** It is declared optional and no live
 *   session carries it (`prime-agent list` prints an empty `name` column too),
 *   so the row title falls back to `firstMessage`. A title built on
 *   `sessionName` alone would render blank for every real session.
 * - `summary` IS present and is documented as "one-line background summary of
 *   what the agent is doing or just did" — it is the activity line, and the
 *   flag-derived labels below are only the fallback before one exists.
 * - Subagents link to their parent by `parentActiveSessionId`, matched against
 *   the parent's `activeSessionId`.
 *
 * Subagent parentage is the one part not confirmed against a live subagent —
 * none were running at the time — so it follows the daemon's own source
 * (`buildRlmChildSnapshots`, which walks `parentActiveSessionId` and states it
 * includes grandchildren). If subagent counts ever read wrong, start here.
 */

/** One entry of the daemon `list` response's `data.sessions`. */
export interface PrimeRosterSession {
  id?: string
  activeSessionId?: string
  sessionId?: string
  sessionName?: string
  cwd?: string
  lifecycle?: string
  activity?: 'working' | 'idle'
  isSessionActive?: boolean
  hasActiveHeartbeat?: boolean
  runtimeKind?: 'top-level' | 'subagent'
  rlmDepth?: number
  parentActiveSessionId?: string
  sessionFile?: string
  summary?: string
  firstMessage?: string
  isStreaming?: boolean
  isCompacting?: boolean
  isBashRunning?: boolean
  isRunningTools?: boolean
  hasRunningRlmChildren?: boolean
  attachedClients?: number
  messageCount?: number
  lastActivityAt?: string
}

/** A single row in the menu-bar roster. */
export interface RunningSessionRow {
  /** The daemon handle to open — `activeSessionId`. */
  id: string
  title: string
  /** One line naming what the session is doing right now. */
  activityLabel: string
  /** True when the agent itself is turning, as opposed to merely pinned. */
  working: boolean
  /** Live descendants hosted under this session, children and deeper. */
  subagentCount: number
  /**
   * On-disk session file, the path `switch_prime_session` takes. Absent when
   * the daemon has not written one yet (a draft session that has never had a
   * message), in which case the row still opens the app but not a session.
   */
  sessionFile?: string
}

/** Default cap on rendered rows. The popover is 360px wide, not a window. */
const DEFAULT_LIMIT = 5
const DEFAULT_TITLE_LENGTH = 44

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const clipped = value.slice(0, maxLength)
  const lastSpace = clipped.lastIndexOf(' ')
  // Break on a word boundary when there is a usable one; a hard cut mid-word
  // reads as corruption rather than truncation.
  const stem = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped
  return `${stem.trimEnd()}…`
}

function sessionHandle(session: PrimeRosterSession): string | undefined {
  return session.activeSessionId ?? session.id
}

/**
 * Whether a roster entry counts as running.
 *
 * Deliberately mirrors Prime's own `classifySessionRosterStatus` — a second,
 * independent definition of "running" in the client would drift from the
 * daemon's the first time either changed.
 */
export function isRosterSessionRunning(session: PrimeRosterSession | null | undefined): boolean {
  if (!session || typeof session !== 'object') return false
  if (!session.activeSessionId) return false
  return (
    session.hasActiveHeartbeat === true ||
    session.activity === 'working' ||
    session.isSessionActive === true ||
    session.hasRunningRlmChildren === true
  )
}

/** The label for a session row. See the note above on `sessionName`. */
export function rosterSessionTitle(
  session: PrimeRosterSession,
  options: { maxLength?: number } = {},
): string {
  const maxLength = options.maxLength ?? DEFAULT_TITLE_LENGTH

  const named = collapseWhitespace(session.sessionName ?? '')
  if (named) return truncate(named, maxLength)

  const message = collapseWhitespace(session.firstMessage ?? '')
  if (message) return truncate(message, maxLength)

  const cwd = collapseWhitespace(session.cwd ?? '').replace(/\/+$/, '')
  const folder = cwd.split('/').filter(Boolean).pop()
  if (folder) return truncate(folder, maxLength)

  return sessionHandle(session) ?? 'Session'
}

function isSubagent(session: PrimeRosterSession): boolean {
  if (session.runtimeKind === 'subagent') return true
  if (session.runtimeKind === 'top-level') return false
  // `runtimeKind` is optional; depth is the fallback signal for a roster that
  // omits it. Roots are depth 0, and fork edges preserve the source depth.
  return typeof session.rlmDepth === 'number' && session.rlmDepth > 0
}

/**
 * Walk a subagent up to the top-level session hosting it.
 *
 * Returns undefined when the chain leaves the roster (a parent that has
 * already exited) or loops. An orphan is dropped rather than promoted: showing
 * it as top-level would present a session the user never started.
 */
function rootHandleFor(
  session: PrimeRosterSession,
  byHandle: Map<string, PrimeRosterSession>,
): string | undefined {
  let current = session
  const seen = new Set<string>()

  while (isSubagent(current)) {
    const handle = sessionHandle(current)
    if (handle) {
      if (seen.has(handle)) return undefined
      seen.add(handle)
    }
    const parentHandle = current.parentActiveSessionId
    if (!parentHandle) return undefined
    const parent = byHandle.get(parentHandle)
    if (!parent) return undefined
    current = parent
  }

  return sessionHandle(current)
}

function activityLabelFor(session: PrimeRosterSession): string {
  const summary = collapseWhitespace(session.summary ?? '')
  if (summary) return truncate(summary, 60)

  if (session.isCompacting) return 'Compacting'
  if (session.isBashRunning) return 'Running a command'
  if (session.isRunningTools) return 'Running tools'
  if (session.isStreaming) return 'Replying'
  if (session.activity === 'working') return 'Working'
  if (session.hasRunningRlmChildren) return 'Waiting on subagents'
  if (session.hasActiveHeartbeat) return 'Waiting on a heartbeat'
  return 'Working'
}

/** Agent-is-turning, as opposed to pinned by a heartbeat or a busy child. */
function isWorking(session: PrimeRosterSession): boolean {
  return session.activity === 'working' || session.isSessionActive === true
}

function validSessions(
  roster: readonly PrimeRosterSession[] | null | undefined,
): PrimeRosterSession[] {
  if (!Array.isArray(roster)) return []
  return roster.filter(
    (session): session is PrimeRosterSession => !!session && typeof session === 'object',
  )
}

function countDescendantsByRoot(sessions: PrimeRosterSession[]): Map<string, number> {
  const byHandle = new Map<string, PrimeRosterSession>()
  for (const session of sessions) {
    const handle = sessionHandle(session)
    if (handle) byHandle.set(handle, session)
  }

  const counts = new Map<string, number>()
  for (const session of sessions) {
    if (!isSubagent(session)) continue
    const root = rootHandleFor(session, byHandle)
    if (!root) continue
    counts.set(root, (counts.get(root) ?? 0) + 1)
  }
  return counts
}

/**
 * Make every rendered title distinct.
 *
 * Observed live the first time this shipped: four running sessions, none with
 * a `firstMessage` (a session with no messages yet has none), two of them
 * rooted at `/Users/dtc`. Both rows rendered as "dtc" — identical, and giving
 * the user no way to tell which session was which or that they were even two
 * different sessions. A row you cannot tell apart from its neighbour is not a
 * row you can click.
 *
 * Only collisions get a suffix; a title that is already unique is left alone,
 * because appending an id to everything would make the common case noisier to
 * fix the rare one.
 */
function disambiguateTitles(rows: RunningSessionRow[]): RunningSessionRow[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.title, (counts.get(row.title) ?? 0) + 1)
  if (![...counts.values()].some((count) => count > 1)) return rows

  return rows.map((row) => (
    (counts.get(row.title) ?? 0) > 1
      ? { ...row, title: `${row.title} · ${row.id.slice(0, 6)}` }
      : row
  ))
}

/**
 * Running top-level sessions, newest and busiest first, capped for the popover.
 *
 * Returns `[]` when nothing is running so the caller can render nothing at all
 * — an empty frame with a heading is the thing #13 explicitly does not want.
 */
export function toRunningSessionRows(
  roster: readonly PrimeRosterSession[] | null | undefined,
  options: { limit?: number; titleLength?: number } = {},
): RunningSessionRow[] {
  const sessions = validSessions(roster)
  if (sessions.length === 0) return []

  const limit = options.limit ?? DEFAULT_LIMIT
  const subagentCounts = countDescendantsByRoot(sessions)

  const rows = sessions
    .filter((session) => !isSubagent(session))
    .filter(isRosterSessionRunning)
    // Sorted as sessions, before mapping: the ordering keys (`working`,
    // `lastActivityAt`) live on the session and are not part of the row.
    .sort((left, right) => {
      // Actively turning sessions first: they are the answer to "is anything
      // working?". Ties break on recency, newest first.
      const leftWorking = isWorking(left)
      const rightWorking = isWorking(right)
      if (leftWorking !== rightWorking) return leftWorking ? -1 : 1
      return (right.lastActivityAt ?? '').localeCompare(left.lastActivityAt ?? '')
    })
    .slice(0, limit)
    .map((session) => {
      const handle = sessionHandle(session) as string
      return {
        id: handle,
        title: rosterSessionTitle(session, { maxLength: options.titleLength }),
        activityLabel: activityLabelFor(session),
        working: isWorking(session),
        subagentCount: subagentCounts.get(handle) ?? 0,
        sessionFile: session.sessionFile,
      }
    })
  return disambiguateTitles(rows)
}

/** How many running sessions the cap hid, for a "+N more" affordance. */
export function runningSessionOverflow(
  roster: readonly PrimeRosterSession[] | null | undefined,
  limit: number = DEFAULT_LIMIT,
): number {
  const running = validSessions(roster)
    .filter((session) => !isSubagent(session))
    .filter(isRosterSessionRunning)
  return Math.max(0, running.length - limit)
}
