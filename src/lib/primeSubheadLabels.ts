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
function inferHomeDir(path: string): string | null {
  const match = /^(\/(?:Users|home)\/[^/]+)/.exec(path)
  return match ? match[1] : null
}

/**
 * Just the vault's folder name, for the composer chip.
 *
 * The subhead already carries the path; down at the composer the question is
 * only "which vault", and a path would crowd out the other chips.
 */
export function vaultLabelFromPath(vaultPath: string | null | undefined): string | null {
  const trimmed = vaultPath?.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  const name = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  return name || null
}
