/**
 * Label helpers for the chat-home telemetry subhead.
 *
 * Pure and separate from the component so the shortening rules can be tested
 * directly — they are the part that can be wrong in a way a render test would
 * not notice.
 */

/** How much of a session uuid the subhead shows, per Frame A's `sess_7f2a`. */
const SESSION_ID_CHARS = 4

/**
 * The recognisable tail of a session id.
 *
 * Prime's ids are uuidv7, so the *leading* characters are a timestamp and are
 * identical across sessions started the same hour — exactly the ones that
 * cannot tell two sessions apart. The end is the random part, so that is what
 * gets shown.
 */
export function shortPrimeSessionId(sessionId: string | null | undefined): string | null {
  const trimmed = sessionId?.trim()
  if (!trimmed) return null

  const lastGroup = trimmed.split('-').filter(Boolean).pop() ?? trimmed
  return lastGroup.slice(-SESSION_ID_CHARS)
}

/**
 * Collapse the home directory to `~`.
 *
 * A vault path in a status strip is there to be recognised, not resolved, and
 * `/Users/someone/Documents/Laputa` spends most of its width on the part every
 * path shares.
 */
export function tildeVaultPath(
  vaultPath: string | null | undefined,
  homeDir?: string | null,
): string | null {
  const trimmed = vaultPath?.trim()
  if (!trimmed) return null

  const home = homeDir?.trim() || inferHomeDir(trimmed)
  if (home && trimmed.startsWith(home)) {
    const rest = trimmed.slice(home.length)
    return rest.startsWith('/') ? `~${rest}` : `~/${rest}`
  }
  return trimmed
}

/**
 * Guess the home directory from the path itself.
 *
 * The renderer has no `$HOME`, and plumbing one through for a cosmetic label
 * would put a Tauri call behind a status strip. `/Users/x` and `/home/x` are
 * the two shapes that matter on the platforms this ships to.
 */
export function inferHomeDir(path: string): string | null {
  const match = /^(\/(?:Users|home)\/[^/]+)/.exec(path)
  return match ? match[1] : null
}

/**
 * How long the attached session has been alive, as a glanceable label.
 *
 * Closing the window no longer ends a session (ADR-0163), so "how long has
 * this been going" stops being obvious from the app being open — a session can
 * outlive several launches. Uptime is what separates *working* from *stuck*:
 * three minutes of silence is thinking, three hours of it is not.
 *
 * Coarse on purpose. Seconds would tick distractingly in a status strip and
 * answer a question nobody asks; below a minute reads as `<1m`.
 *
 * Returns `null` for a missing or unparseable timestamp, and for one in the
 * future — a clock skew should show nothing rather than a negative age.
 */
export function primeSessionUptime(
  startedAt: string | null | undefined,
  now: number = Date.now(),
): string | null {
  const trimmed = startedAt?.trim()
  if (!trimmed) return null

  const started = Date.parse(trimmed)
  if (Number.isNaN(started)) return null

  const elapsedMinutes = Math.floor((now - started) / 60_000)
  if (elapsedMinutes < 0) return null
  if (elapsedMinutes < 1) return '<1m'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`

  const hours = Math.floor(elapsedMinutes / 60)
  if (hours < 24) {
    const minutes = elapsedMinutes % 60
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`
}
