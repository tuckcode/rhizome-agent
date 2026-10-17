import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke, updateMockContent } from '../mock-tauri'
import { getSaveBaseline } from './noteContentCache'
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
