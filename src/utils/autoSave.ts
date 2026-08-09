import { persistContent } from '../hooks/useSaveNote'

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
  const flushed = await deps.savePendingForPath(path)
  if (flushed) return

  const tabContent = deps.getTabContent(path)
  if (tabContent === undefined) return

  if (deps.isUnsaved(path)) {
    await persistContent(path, tabContent)
    deps.onSaved?.(path, tabContent)
  }
}
