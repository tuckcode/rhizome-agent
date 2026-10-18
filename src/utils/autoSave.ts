import { setSaveBaseline } from '../hooks/noteContentCache'
import { persistContentChecked, stashSaveConflict, subscribeSaveConflicts } from '../hooks/useSaveNote'

export interface FlushDeps {
  savePendingForPath: (path: string) => Promise<boolean>
  getTabContent: (path: string) => string | undefined
  isUnsaved: (path: string) => boolean
  onSaved?: (path: string, content: string) => void
}

/**
 * Flush unsaved editor content to disk for a given path before a destructive action.
 *
 * 1. Try flushing the pending content ref (handles the currently-editing note).
 * 2. If nothing was pending, check if the tab has unsaved content (either newly
 *    created or modified in the editor) and persist it directly.
 */
export async function flushEditorContent(path: string, deps: FlushDeps): Promise<void> {
  let conflicted = false
  const unsubscribe = subscribeSaveConflicts(() => { conflicted = true })
  try {
    const flushed = await deps.savePendingForPath(path)
    if (flushed) return
    const tabContent = deps.getTabContent(path)
    if (tabContent === undefined) return
    // The pending flush already stashed this conflict. A second checked
    // save would run the same refusal again.
    if (conflicted) {
      deps.onSaved?.(path, tabContent)
      return
    }

    if (deps.isUnsaved(path)) {
      // Same conflict check as the editor save, so a destructive action
      // never writes over a newer note on disk. A conflict is stashed and
      // the unsaved flag drops, so switching notes is not cancelled.
      try {
        const saved = await persistContentChecked(path, tabContent)
        setSaveBaseline(path, saved)
        deps.onSaved?.(path, saved)
      } catch (error) {
        await stashSaveConflict(error, path, tabContent)
        deps.onSaved?.(path, tabContent)
      }
    }
  } finally {
    unsubscribe()
  }
}
