/**
 * Whether Chat home shows its sessions column, remembered across launches.
 *
 * The column itself already rendered to the left of the transcript; what was
 * wrong was that it started closed, behind a 22x22 clock in a second header
 * row. The window people land on was an empty transcript and a composer, with
 * no sign that sessions existed at all (visual audit, 2026-08-20).
 *
 * Pure and storage-agnostic so the decision can be tested without a DOM: the
 * caller reads and writes `localStorage`, this decides what a value means.
 */

/** What a machine with no stored preference gets. */
export const chatSessionsOpenDefault = true

const OPEN = '1'
const CLOSED = '0'

/**
 * Interpret a stored preference.
 *
 * Only the exact string this module writes for "closed" closes the column.
 * Anything else — absent, empty, a leftover value from some other shape, a
 * half-written entry — falls back to open. The asymmetry is deliberate: with
 * a default of open, a value we cannot read must not silently take the column
 * away, because that is indistinguishable from the feature breaking.
 */
export function readChatSessionsOpen(raw: string | null): boolean {
  return raw === CLOSED ? false : chatSessionsOpenDefault
}

/** The value to store for a given state. */
export function storedChatSessionsOpen(open: boolean): string {
  return open ? OPEN : CLOSED
}
