import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke, updateMockContent } from '../mock-tauri'
import { getSaveBaseline, setSaveBaseline } from './noteContentCache'
import { cacheNoteContent } from './useTabManagement'

/** Result of `save_note_content_checked`. */
export interface SaveOutcome {
  contentHash: string
  /** Set when the on-disk Status was spliced into the buffer. */
  splicedContent: string | null
}

/**
 * Save with the conflict check. Returns the text now on disk: the buffer,
 * or the buffer with a Status a board move wrote. A real conflict throws
 * an error that starts with "Save conflict:" and writes nothing.
 */
export async function persistContentChecked(path: string, content: string): Promise<string> {
  if (!isTauri()) {
    await mockInvoke('save_note_content', { path, content })
    return content
  }
  // The text goes to Rust, which hashes it, so the save stays synchronous
  // up to the invoke. No baseline means no check, the same as before.
  const expectedContent = getSaveBaseline(path)
  const outcome = await invoke<SaveOutcome | null>('save_note_content_checked', { path, content, expectedContent })
  return outcome?.splicedContent ?? content
}

/** Start of the error a checked save returns on a real conflict. */
export const SAVE_CONFLICT_PREFIX = 'Save conflict:'

export function isSaveConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith(SAVE_CONFLICT_PREFIX)
}

/** A save the conflict check refused. The buffer is safe in `copyPath`. */
export interface SaveConflict {
  path: string
  content: string
  copyPath: string
}

type SaveConflictListener = (conflict: SaveConflict) => void
const saveConflictListeners = new Set<SaveConflictListener>()

export function subscribeSaveConflicts(listener: SaveConflictListener): () => void {
  saveConflictListeners.add(listener)
  return () => { saveConflictListeners.delete(listener) }
}

export function emitSaveConflict(conflict: SaveConflict): void {
  for (const listener of saveConflictListeners) listener(conflict)
}

/**
 * A real conflict. The buffer goes to a "(conflict)" copy and listeners
 * offer Keep mine and Reload. The caller can then drop the buffer so
 * navigation continues. Any other error, or a failed copy, throws as
 * before and the buffer stays pending.
 */
export async function stashSaveConflict(error: unknown, path: string, content: string): Promise<void> {
  if (!isSaveConflictError(error)) throw error
  try {
    const copyPath = await stashConflictCopy(path, content)
    emitSaveConflict({ path, content, copyPath })
  } catch (stashError) {
    console.error('Failed to stash conflicting edits:', stashError)
    throw error
  }
}

const MAX_CONFLICT_COPIES = 20

/** `plan.md` -> `plan (conflict).md`, then `plan (conflict 2).md`. */
export function conflictCopyPath(path: string, attempt = 1): string {
  const suffix = attempt === 1 ? ' (conflict)' : ` (conflict ${attempt})`
  const dot = path.lastIndexOf('.')
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return dot > slash ? `${path.slice(0, dot)}${suffix}${path.slice(dot)}` : `${path}${suffix}`
}

function createNote(path: string, content: string): Promise<unknown> {
  return isTauri()
    ? invoke('create_note_content', { path, content })
    : mockInvoke('create_note_content', { path, content })
}

/** The conflict copy each note's edits went to, until the user chooses. */
const stashedCopies = new Map<string, string>()

export function clearStashedConflict(path: string): void {
  stashedCopies.delete(path)
}

/**
 * Writes the buffer to a "(conflict)" note next to the original, so no
 * edit is lost while the user decides. The first conflict creates a new
 * file and never overwrites one. Later conflicts on the same note update
 * that copy, so typing on does not make a new file each time.
 */
export async function stashConflictCopy(path: string, content: string): Promise<string> {
  const existing = stashedCopies.get(path)
  if (existing) {
    await overwriteNoteContent(existing, content)
    return existing
  }
  for (let attempt = 1; attempt <= MAX_CONFLICT_COPIES; attempt += 1) {
    const copyPath = conflictCopyPath(path, attempt)
    try {
      await createNote(copyPath, content)
      stashedCopies.set(path, copyPath)
      return copyPath
    } catch (error) {
      if (!String(error instanceof Error ? error.message : error).includes('already exists')) throw error
    }
  }
  throw new Error(`No free conflict copy name for ${path}`)
}

/** "Keep mine": write the text over the note with no check, and make it the baseline. */
export async function overwriteNoteContent(path: string, content: string): Promise<void> {
  if (isTauri()) {
    await invoke('save_note_content', { path, content })
  } else {
    await mockInvoke('save_note_content', { path, content })
    updateMockContent(path, content)
  }
  setSaveBaseline(path, content)
}

/**
 * Hook that provides an explicit save function for note content.
 * Called on Cmd+S — no debounce, no auto-save.
 *
 * @param updateContent - callback to also update in-memory state after save
 */
export function useSaveNote(updateContent: (path: string, content: string) => void) {
  const saveNote = useCallback(async (path: string, content: string): Promise<string> => {
    const saved = await persistContentChecked(path, content)
    cacheNoteContent(path, saved)
    if (!isTauri()) {
      updateMockContent(path, saved)
    }
    updateContent(path, saved)
    return saved
  }, [updateContent])

  return { saveNote }
}
