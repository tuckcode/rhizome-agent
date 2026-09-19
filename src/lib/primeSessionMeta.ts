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

import { disambiguateTitles } from './disambiguateTitles'
import { inferHomeDir } from './primeSubheadLabels'

export interface PrimeSessionSummary {
  id: string
  path: string
  title?: string | null
  cwd?: string | null
  startedAt?: string | null
  gitBranch?: string | null
  mtimeMs?: number | null
  /**
   * Whether the log holds any message at all. Sessions without one are unused
   * drafts and are already filtered out by `list_sessions` (#28); the field is
   * mirrored here so the shape matches what Rust serialises.
   */
  hasConversation?: boolean
  /**
   * Filed out of the main list by the user. Rhizome's own state, kept in its
   * settings — nothing under `~/.prime/agent/sessions` is moved or deleted,
   * because that directory is Prime's and is shared with its CLI and every
   * other client. Archiving is a view, and it is reversible.
   */
  archived?: boolean
  /** Ran in a temp directory — test and probe residue, grouped out of the main list. */
  scratch?: boolean
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
 * Where a session ran, short enough for a 228px column — or `null` when
 * saying so would be noise.
 *
 * The list shows every log in `~/.prime/agent/sessions` whoever wrote it, and
 * #28 called the result unexplained clutter. It is: measured on 93 real logs,
 * 16 distinct working directories, and **28 of the 93 ran in a temp
 * directory** — test runs rather than anyone's work.
 *
 * Naming the *client* is not on offer. The `session` header line carries
 * `cwd`, `timestamp`, `git` and sometimes `parentSession`, and no client field
 * at all across all 93 logs. Where a session ran is the answer the data
 * actually supports, so it is the one given.
 *
 * Returns `null` for the vault that is currently open, because labelling every
 * row "Rhizome Vault" inside the Rhizome Vault spends the common case to serve
 * the rare one. A row earns its place by being from somewhere *else*.
 *
 * Home collapses to `~`: the basename of `/Users/dtc` is a username, which
 * names nothing. Inferred from the path shape rather than read from the
 * environment, the way `tildeVaultPath` already does it — the renderer has no
 * `$HOME` and this is a cosmetic label, not worth a Tauri call.
 */
export function primeSessionPlace(
  session: PrimeSessionSummary,
  vaultPath: string | null | undefined,
): string | null {
  const cwd = session.cwd?.trim()
  if (!cwd) return null

  const withoutTrailingSlash = (path: string) => path.replace(/\/+$/, '') || '/'
  const here = withoutTrailingSlash(cwd)
  const vault = vaultPath?.trim()
  if (vault && here === withoutTrailingSlash(vault)) return null

  if (here === inferHomeDir(here)) return '~'
  return here.slice(here.lastIndexOf('/') + 1) || here
}

/**
 * The meta line under a session title.
 *
 * Per Frame F: `Today · 14:08`, `Yesterday`, `Mon`, else a short date, with
 * where it ran appended when that is somewhere other than the open vault —
 * `Today · 14:08 · rhizome-agent`. Time leads because it is the sort key, so
 * the leftmost thing on every row lines up; the place truncates first when the
 * column runs out, which is the right thing to lose. The git branch follows
 * when the session has one, so a glance names the worktree without opening it.
 *
 * A session mid-turn reads `Working · tools` and nothing else — what it is
 * doing now matters more than when or where, and it is the session already on
 * screen.
 */
export function primeSessionMetaLabel(
  session: PrimeSessionSummary,
  now: number,
  options: { working?: boolean; vaultPath?: string | null } = {},
): string | null {
  if (options.working) return 'Working · tools'

  const place = primeSessionPlace(session, options.vaultPath)
  const branch = session.gitBranch?.trim() || null
  const timestamp = session.mtimeMs
  // No timestamp used to mean no meta line at all. Where it ran is still worth
  // saying: a row with a place beats a row with nothing under its title.
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    if (place && branch) return `${place} · ${branch}`
    return place ?? branch
  }

  const when = (() => {
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
  })()

  return [when, place, branch].filter(Boolean).join(' · ')
}

/**
 * The label for each row, in the order given, with no two the same.
 *
 * A session with messages but no *user* message has no title — Prime derives
 * one from the first user turn and there is nothing authoritative to prefer
 * over that — so it falls back to the localized "Untitled". Two of those used
 * to render as two identical rows, which is #28's title and the part #30
 * carried: a row you cannot tell from its neighbour is not a row you can
 * click.
 *
 * Suffixed with the **end** of the id, not the start. Session ids are uuidv7,
 * whose leading characters are a timestamp: measured on 93 real logs in
 * `~/.prime/agent/sessions`, the first six characters gave 23 distinct values
 * and a single prefix covered 23 sessions. The random tail gave 93. The
 * running-session list suffixes with the start because a daemon handle is
 * random throughout — same helper, different id shape.
 */
export function primeSessionRowTitles(
  sessions: readonly PrimeSessionSummary[],
  untitled: string,
  metas: readonly (string | null)[] = [],
): string[] {
  // Collision is a property of the whole row, not the title.
  //
  // The first version of this suffixed any repeated *title*, which put hex on
  // rows a user could already tell apart:
  //
  //     Untitled session · e521f9        Untitled session · 904ab3
  //     Today · 07:29 · rhizome-agent    Yesterday · tmp
  //
  // Those meta lines differ completely; the suffix solved a collision the
  // second line had already resolved, on the line the eye reads first. A
  // suffix is only worth its noise when the rendered row would genuinely
  // repeat — same title *and* same meta. #33.
  const rows = sessions.map((session, index) => ({
    id: session.id,
    title: session.title?.trim() || untitled,
    meta: metas[index] ?? '',
  }))
  return disambiguateTitles(rows, (row) => row.id.slice(-6), (row) => `${row.title}\u0000${row.meta}`)
    .map((row) => row.title)
}

/**
 * What a row's status dot means: is this session alive, and is it turning?
 *
 * Three states, because two were not enough. Sessions outlive the window
 * (ADR-0163) and several run at once (#13), so "saved" and "running but idle"
 * are genuinely different things to a user deciding what to open — and until
 * now the list showed a dot for the *attached* session only, which meant a
 * goal continuing in a background session looked exactly like a dead one.
 *
 * `running` is keyed by log path because that is the only join between the
 * two data sources: the list is read off disk and cannot know what is
 * running, and the roster knows what is running and is not a history.
 */
export type PrimeSessionStatus = 'working' | 'running' | 'saved'

export function primeSessionStatus(
  session: PrimeSessionSummary,
  running: ReadonlyMap<string, boolean>,
): PrimeSessionStatus {
  const workingHere = running.get(session.path)
  if (workingHere === undefined) return 'saved'
  return workingHere ? 'working' : 'running'
}

/** Newest first by default. Sessions with no timestamp sink to the bottom. */
export type PrimeSessionSortKey = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

export function sortPrimeSessions(
  sessions: PrimeSessionSummary[],
  key: PrimeSessionSortKey = 'newest',
): PrimeSessionSummary[] {
  const copy = [...sessions]
  const titleOf = (session: PrimeSessionSummary) => session.title?.trim().toLowerCase() ?? ''
  const newestDelta = (a: PrimeSessionSummary, b: PrimeSessionSummary) =>
    (b.mtimeMs ?? -Infinity) - (a.mtimeMs ?? -Infinity)

  switch (key) {
    case 'oldest':
      return copy.sort((a, b) => (a.mtimeMs ?? Infinity) - (b.mtimeMs ?? Infinity))
    case 'title-asc':
      return copy.sort((a, b) => titleOf(a).localeCompare(titleOf(b)) || newestDelta(a, b))
    case 'title-desc':
      return copy.sort((a, b) => titleOf(b).localeCompare(titleOf(a)) || newestDelta(a, b))
    default:
      return copy.sort(newestDelta)
  }
}

/**
 * The conversation to reopen when Chat would otherwise be empty.
 *
 * Archived and scratch rows stay out. `list_sessions` already drops unused
 * drafts (#28); `hasConversation === false` is the same idea if it arrives.
 */
export function pickLastConversation(sessions: PrimeSessionSummary[]): PrimeSessionSummary | null {
  const eligible = sessions.filter(
    (session) => !session.archived && !session.scratch && session.hasConversation !== false,
  )
  return sortPrimeSessions(eligible)[0] ?? null
}

/**
 * Whether a session row belongs in a typed filter (#34).
 *
 * Title, place, and branch are already on the row. Conversation content is
 * not — that would mean reading logs, and this list exists so opening it
 * never does that. `displayTitle` is the label on screen, including any
 * untitled suffix, so a search for what the user can see still hits.
 */
export function primeSessionMatchesQuery(
  session: PrimeSessionSummary,
  query: string,
  displayTitle?: string | null,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const fields = [displayTitle, session.title, session.cwd, session.gitBranch]
  return fields.some((field) => field?.toLowerCase().includes(needle))
}

/** Scope chips on the session list, beside the existing text search. */
export type PrimeSessionFilterKey = 'all' | 'vault' | 'running' | 'today'

function samePath(left: string, right: string): boolean {
  const strip = (path: string) => path.replace(/\/+$/, '') || '/'
  return strip(left) === strip(right)
}

/**
 * Whether a session belongs in a scope filter (vault / running / today).
 *
 * Text search stays in `primeSessionMatchesQuery`. This is the other axis:
 * place, live roster, or calendar day. Missing cwd cannot match the vault.
 */
export function primeSessionMatchesFilter(
  session: PrimeSessionSummary,
  key: PrimeSessionFilterKey,
  options: {
    now: number
    vaultPath?: string | null
    running?: ReadonlyMap<string, boolean>
  },
): boolean {
  switch (key) {
    case 'all':
      return true
    case 'vault': {
      const cwd = session.cwd?.trim()
      const vault = options.vaultPath?.trim()
      if (!cwd || !vault) return false
      return samePath(cwd, vault)
    }
    case 'running':
      return primeSessionStatus(session, options.running ?? new Map()) !== 'saved'
    case 'today':
      return primeSessionAge(session, options.now) === 'today'
  }
}
