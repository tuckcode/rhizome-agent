/**
 * Display helpers for Prime's scheduled work — heartbeats and cron jobs (#14).
 *
 * Pure, and takes `now` as an argument so the relative-time labels are testable
 * on a day other than the one they were written.
 *
 * Mirrors `PrimeScheduledWork` in `src-tauri/src/prime_agent_activity.rs`. The
 * shape there was **observed against prime-agent 0.7.4**, not inferred — the
 * previous inferred version read every heartbeat field as null, because
 * `heartbeats_list` wraps each job in a `{"job": …}` envelope and `schedule` is
 * an object rather than a string.
 */

export interface PrimeScheduledWork {
  id?: string
  /** The prompt this will send, used as the row's name. */
  label?: string
  /** Human cadence, from `schedule.expression` — "every 30 minutes". */
  interval?: string
  /** `active` | `paused` | `completed` | `cancelled`. */
  status?: string
  /** `cron` | `heartbeat` | `rlm_heartbeat`. */
  source?: string
  /** ISO-8601 next fire time. */
  nextRunAt?: string
  /** Whether pause/resume is available — heartbeats only. */
  isHeartbeat?: boolean
}

const HEARTBEAT_SOURCES = new Set(['heartbeat', 'rlm_heartbeat'])

/**
 * Whether this entry can be paused.
 *
 * The daemon exposes `heartbeat_manage` (pause/resume/stop) but has **no**
 * `cron_pause`, so a plain schedule can only be cancelled. Untagged entries are
 * treated as *not* heartbeats — failing safe, since offering a pause the
 * backend cannot honour is worse than omitting it.
 */
export function isHeartbeatWork(item: PrimeScheduledWork): boolean {
  return HEARTBEAT_SOURCES.has((item.source ?? '').trim())
}

/** Tag each entry with what the UI is allowed to offer for it. */
export function withHeartbeatFlag(items: readonly PrimeScheduledWork[]): PrimeScheduledWork[] {
  return items.map((item) => ({ ...item, isHeartbeat: isHeartbeatWork(item) }))
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * When this fires next, as a short relative phrase.
 *
 * Relative rather than absolute because the question a person asks of a
 * heartbeat is "how soon", not "at what timestamp". Returns null for a missing
 * or unparseable time so the row simply omits it.
 */
export function scheduledWorkNextRun(
  item: PrimeScheduledWork,
  now: number = Date.now(),
): string | null {
  const raw = (item.nextRunAt ?? '').trim()
  if (!raw) return null
  const at = Date.parse(raw)
  if (!Number.isFinite(at)) return null

  const delta = at - now
  // A schedule whose next run is in the past is due, not overdue-by-3-seconds;
  // clock skew between the daemon and the UI makes small negatives meaningless.
  if (delta <= MINUTE) return 'due'
  if (delta < HOUR) return `in ${Math.round(delta / MINUTE)}m`
  if (delta < DAY) return `in ${Math.round(delta / HOUR)}h`
  return `in ${Math.round(delta / DAY)}d`
}
