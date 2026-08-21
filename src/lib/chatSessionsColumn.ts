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

import { readBooleanPreference, storedBooleanPreference } from './uiPreference'

/** What a machine with no stored preference gets. */
export const chatSessionsOpenDefault = true

/**
 * Interpret a stored preference. Falls back to open for anything unreadable —
 * see `readBooleanPreference`, which the command rail shares.
 */
export function readChatSessionsOpen(raw: string | null): boolean {
  return readBooleanPreference(raw, chatSessionsOpenDefault)
}

/** The value to store for a given state. */
export function storedChatSessionsOpen(open: boolean): string {
  return storedBooleanPreference(open)
}
