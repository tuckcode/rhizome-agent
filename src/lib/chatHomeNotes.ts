import type { VaultEntry } from '../types'

/** A note that the chat home offers as context for a new chat. */
export interface ChatHomeNote {
  path: string
  title: string
  /** Seconds since the epoch. */
  modifiedAt: number
}

export const CHAT_HOME_NOTE_LIMIT = 4

/**
 * The notes that changed last. The chat home shows them so that one
 * click starts a chat about the work that the user just did.
 */
export function recentNotesForChatHome(
  entries: readonly VaultEntry[],
  limit: number = CHAT_HOME_NOTE_LIMIT,
): ChatHomeNote[] {
  return entries
    .filter((entry) => !entry.archived && entry.fileKind !== 'binary' && entry.modifiedAt)
    .sort((left, right) => (right.modifiedAt ?? 0) - (left.modifiedAt ?? 0))
    .slice(0, limit)
    .map((entry) => ({
      path: entry.path,
      title: entry.title || entry.filename.replace(/\.[^.]+$/, '') || entry.path,
      modifiedAt: entry.modifiedAt ?? 0,
    }))
}

/** Composer text that refers to the note and leaves the caret after it. */
export function chatHomePrefillForNote(note: ChatHomeNote): string {
  return `[[${note.title}]] `
}
