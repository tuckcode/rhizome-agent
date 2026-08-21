/**
 * Reading and writing the small on/off preferences the shell remembers per
 * machine — is the sessions column open, is the command rail expanded.
 *
 * Pure and storage-agnostic: the caller touches `localStorage`, this decides
 * what a value means. That keeps the decision testable without a DOM, and
 * keeps every such preference agreeing on what a corrupted value does.
 */

const ON = '1'
const OFF = '0'

/**
 * Interpret a stored preference, falling back when it is not one of ours.
 *
 * Only the exact strings this module writes are honoured. Absent, empty, or
 * left over from some other shape all fall back — and the fallback is the
 * feature's default rather than "off", because for a default-on affordance a
 * value we cannot parse must not silently take it away. That is
 * indistinguishable from the feature breaking.
 */
export function readBooleanPreference(raw: string | null, fallback: boolean): boolean {
  if (raw === ON) return true
  if (raw === OFF) return false
  return fallback
}

/** The value to store for a given state. */
export function storedBooleanPreference(value: boolean): string {
  return value ? ON : OFF
}

/**
 * Read one through `localStorage`, surviving a storage that throws.
 *
 * Private browsing modes and locked-down webviews make `localStorage` access
 * throw rather than return null, and a shell that cannot paint because a
 * preference could not be read is worse than one that forgets a preference.
 */
export function readStoredBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    return readBooleanPreference(localStorage.getItem(key), fallback)
  } catch {
    return fallback
  }
}

/** Write one, ignoring a storage that will not have it. */
export function writeStoredBooleanPreference(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, storedBooleanPreference(value))
  } catch {
    // A machine with no usable storage still gets the toggle, just not the
    // memory of it.
  }
}
