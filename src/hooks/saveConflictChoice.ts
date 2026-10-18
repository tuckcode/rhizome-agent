import { notePathsMatch } from '../utils/notePathIdentity'

/** Clear the stash and the unsaved flag. Reload the tab only while it is still active. */
export function finishConflictChoice({
  activePath,
  conflictPath,
  clearStash,
  clearUnsaved,
  reloadActive,
}: {
  activePath: string | null
  conflictPath: string
  clearStash: () => void
  clearUnsaved: () => void
  reloadActive: () => void
}): void {
  clearStash()
  clearUnsaved()
  if (activePath && notePathsMatch(activePath, conflictPath)) reloadActive()
}

/**
 * Read the editor after the in-flight autosave has finished. Reading
 * before that wait keeps the text from the click, not the text the
 * autosave just settled.
 */
export async function keepMineAfterHold({
  hold,
  readLive,
  snapshot,
  write,
}: {
  hold: () => Promise<unknown>
  readLive: () => string | undefined
  snapshot: string
  write: (content: string) => Promise<void>
}): Promise<void> {
  await hold()
  await write(readLive() ?? snapshot)
}
