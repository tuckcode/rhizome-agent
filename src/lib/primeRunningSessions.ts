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
  /**
   * Prime's RLM node id. `cancel_rlm_child` wants this, not the daemon
   * handle. Present on subagent roster rows (probed in daemon-session-list:
   * `id` is already `rlmChildId ?? activeSessionId`).
   */
  rlmChildId?: string
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
  /**
   * What the session is waiting on, as Prime computes it: `needs_input` when
   * the last turn ended on the user, `completed` when the task finished.
   * Probed live against 0.7.4 — it is absent from `daemon-session-list.d.ts`.
   */
  taskState?: 'needs_input' | 'completed'
}

/**
 * Every status this module can report, in the order `activityFor` tests
 * them. Exported as a tuple so the locale file and the view can be checked
 * against one list rather than three copies of the same eight strings.
 */
export const ROSTER_ACTIVITY_KEYS = [
  'compacting',
  'runningCommand',
  'runningTools',
  'replying',
  'working',
  'waitingOnSubagents',
  'waitingOnHeartbeat',
  'waitingForYou',
] as const

export type RosterActivityKey = (typeof ROSTER_ACTIVITY_KEYS)[number]

/**
 * The locale key carrying the copy for one status.
 *
 * The return type is the template literal rather than `string` so it satisfies
 * the translator's union of known message keys. Typed as `string` this
 * compiles under `tsc --noEmit` and fails under `tsc -b`, which is what the
 * pre-push build caught.
 */
export function rosterActivityMessageKey(
  key: RosterActivityKey,
): `menuBarCompanion.activity.${RosterActivityKey}` {
  return `menuBarCompanion.activity.${key}`
}

/**
 * What a session is doing, in a form the view can render in any locale.
 *
 * Two kinds because there are genuinely two sources. A `summary` is the
 * daemon's own sentence about the work — prose we did not write and cannot
 * translate, passed through as-is. A `status` is our own classification of the
 * flags, which is copy we own and must not hard-code in English (C34).
 */
export type RosterActivity =
  | { kind: 'summary'; text: string }
  | { kind: 'status'; key: RosterActivityKey }

/** A single row in the menu-bar roster. */
export interface RunningSessionRow {
  /** The daemon handle to open — `activeSessionId`. */
  id: string
  title: string
  /** What the session is doing right now — see `RosterActivity`. */
  activity: RosterActivity
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
import { disambiguateTitles } from './disambiguateTitles'

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
 * Id `cancel_rlm_child` accepts. The daemon handle is a different field —
 * sending it makes Prime look up a child that is not there.
 */
function rlmCancelId(session: PrimeRosterSession): string | undefined {
  const childId = collapseWhitespace(session.rlmChildId ?? '')
  if (childId) return childId
  // Prime's list already puts rlmChildId in `id` for subagents.
  if (isSubagent(session)) {
    const listed = collapseWhitespace(session.id ?? '')
    if (listed) return listed
  }
  return sessionHandle(session)
}

function fileStemEquals(path: string, id: string): boolean {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const file = slash >= 0 ? path.slice(slash + 1) : path
  const stem = file.endsWith('.jsonl') ? file.slice(0, -6) : file
  return stem === id
}

/**
 * Chat's host status reports Prime's durable `sessionId`, not the daemon
 * handle the roster parents on. Resolve either (or a log-path stem) to the
 * handle `rootHandleFor` walks to.
 */
function resolveLiveRootHandle(
  sessions: readonly PrimeRosterSession[],
  liveId: string,
): string {
  for (const session of sessions) {
    if (isSubagent(session)) continue
    const handle = sessionHandle(session)
    if (!handle) continue
    if (handle === liveId) return handle
    if (session.sessionId === liveId) return handle
    if (session.sessionFile && fileStemEquals(session.sessionFile, liveId)) return handle
  }
  return liveId
}

/**
 * The markers `cli_agent_runtime::build_prompt` composes a prompt with. Kept
 * as literals rather than imported because the Rust side owns them and there
 * is no shared source; `prime_sessions.rs` holds the same pair for the history
 * list, and `a_title_is_the_users_words_not_the_system_block_in_front_of_them`
 * is its regression test.
 */
const SYSTEM_INSTRUCTIONS_PREFIX = 'System instructions:\n'
const USER_REQUEST_MARKER = '\n\nUser request:\n'

/**
 * Recover what the user typed from a composed first message.
 *
 * `firstMessage` is the prompt Rhizome *sent*, not the words the user wrote,
 * so every Rhizome session's begins with the same system block. Titled raw,
 * every row in the popover reads "System instructions: You are working inside
 * Rhizome…" and no two rows can be told apart. C26 fixed this for the history
 * list; the roster is the same input on a second surface.
 *
 * **Strip before normalising.** The markers are newline-delimited, so
 * collapsing whitespace first turns `\n\nUser request:\n` into a single space
 * and the split silently stops matching — a no-op that still passes its tests.
 * That exact mistake was made once already in the Rust version.
 */
function userWordsFrom(message: string): string {
  if (!message.startsWith(SYSTEM_INSTRUCTIONS_PREFIX)) return message
  const marker = message.indexOf(USER_REQUEST_MARKER)
  if (marker < 0) return message
  return message.slice(marker + USER_REQUEST_MARKER.length)
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

  const message = collapseWhitespace(userWordsFrom(session.firstMessage ?? ''))
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

function activityFor(session: PrimeRosterSession): RosterActivity {
  const summary = collapseWhitespace(session.summary ?? '')
  if (summary) return { kind: 'summary', text: truncate(summary, 60) }

  const status = (key: RosterActivityKey): RosterActivity => ({ kind: 'status', key })

  if (session.isCompacting) return status('compacting')
  if (session.isBashRunning) return status('runningCommand')
  if (session.isRunningTools) return status('runningTools')
  if (session.isStreaming) return status('replying')
  if (session.activity === 'working') return status('working')
  if (session.hasRunningRlmChildren) return status('waitingOnSubagents')
  if (session.hasActiveHeartbeat) return status('waitingOnHeartbeat')
  // Last, and only once nothing more specific applies: a session held open
  // with no turn running is waiting on the user, not working. Without this it
  // fell through to "Working" — the one thing it is definitely not doing.
  if (session.taskState === 'needs_input') return status('waitingForYou')
  return status('working')
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

/** One RLM child (or grandchild) of the live chat session. */
export interface RlmFamilyMember {
  /** Id sent to `cancel_rlm_child`. */
  id: string
  title: string
  activity: RosterActivity
  working: boolean
  /** 1 = direct child. Deeper numbers are grandchildren. */
  depth: number
}

/**
 * The live session's RLM family, from the roster we already poll.
 *
 * `liveId` may be the daemon handle *or* the durable `sessionId` Chat's host
 * status reports. Menu-bar rows hide these and only count them. Chat needs
 * the members themselves so a parent can see and stop its children.
 */
export function familyForRoot(
  roster: readonly PrimeRosterSession[] | null | undefined,
  rootHandle: string | null | undefined,
): RlmFamilyMember[] {
  if (!rootHandle) return []
  const sessions = validSessions(roster)
  if (sessions.length === 0) return []

  const liveHandle = resolveLiveRootHandle(sessions, rootHandle)

  const byHandle = new Map<string, PrimeRosterSession>()
  for (const session of sessions) {
    const handle = sessionHandle(session)
    if (handle) byHandle.set(handle, session)
  }

  const members: RlmFamilyMember[] = []
  for (const session of sessions) {
    if (!isSubagent(session)) continue
    if (rootHandleFor(session, byHandle) !== liveHandle) continue
    const id = rlmCancelId(session)
    if (!id) continue
    members.push({
      id,
      title: rosterSessionTitle(session),
      activity: activityFor(session),
      working: isWorking(session),
      depth: session.rlmDepth && session.rlmDepth > 0 ? session.rlmDepth : 1,
    })
  }

  return members.sort((left, right) => left.depth - right.depth || left.title.localeCompare(right.title))
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
        activity: activityFor(session),
        working: isWorking(session),
        subagentCount: subagentCounts.get(handle) ?? 0,
        sessionFile: session.sessionFile,
      }
    })
  // A daemon handle is random throughout, so its leading characters
  // distinguish it. That is not true of every id — see the note in
  // `disambiguateTitles` about uuidv7 session ids, whose prefix is a clock.
  return disambiguateTitles(rows, (row) => row.id.slice(0, 6))
}

/**
 * Which session logs the daemon says are alive, and which of those are
 * mid-turn — keyed by log path, to cross-reference the *disk* list.
 *
 * The two data sources answer different questions and have bitten before:
 * `list_prime_session_summaries` reads logs off disk and cannot know what is
 * running, while the roster knows what is running and is not a history. The
 * join between them is the log path — `sessionFile` here, `path` there.
 *
 * Uncapped and un-filtered, unlike `toRunningSessionRows`: that one is shaped
 * for a five-row popover, and a sidebar marking only the first five sessions
 * as alive would be wrong in a way the user could not see. Subagents count as
 * running too — a subagent that is turning is a live session, and if its log
 * is in the list it should not read as dead.
 *
 * A session the daemon reports without a `sessionFile` is skipped rather than
 * guessed at: the daemon does not always write one, and inventing a path from
 * an id is how the wrong row lights up.
 */
export function runningSessionFilesByPath(
  roster: readonly PrimeRosterSession[] | null | undefined,
): Map<string, boolean> {
  const running = new Map<string, boolean>()
  for (const session of validSessions(roster)) {
    // Deliberately *not* `isRosterSessionRunning`: that answers "is this doing
    // work" — heartbeat, turning, live children — which is the narrower
    // question the menu bar asks. Here the question is "is the daemon still
    // holding this session", because a resident session sitting idle can be
    // reattached and can still fire a goal, and telling the user it is dead
    // would be wrong. Being in the roster with a handle is that answer.
    if (!session.activeSessionId) continue
    const file = session.sessionFile?.trim()
    if (!file) continue
    // A path already marked working stays working: two roster entries can
    // share a log, and "something here is turning" is the honest summary.
    running.set(file, (running.get(file) ?? false) || isWorking(session))
  }
  return running
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
