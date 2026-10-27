import type { MutableRefObject } from 'react'

export interface FolderRenameSaveSync {
  flushNotesInFolder: (prefix: string) => Promise<void>
  retargetNotesInFolder: (oldPrefix: string, newPrefix: string) => void
}

let activeSync: MutableRefObject<FolderRenameSaveSync> | null = null

export function registerFolderRenameSaveSync(sync: MutableRefObject<FolderRenameSaveSync>): void {
  activeSync = sync
}

export function unregisterFolderRenameSaveSync(sync: MutableRefObject<FolderRenameSaveSync>): void {
  if (activeSync === sync) activeSync = null
}

export async function flushSavesInFolder(prefix: string): Promise<void> {
  await activeSync?.current.flushNotesInFolder(prefix)
}

export function retargetSavesAfterFolderRename(oldPrefix: string, newPrefix: string): void {
  activeSync?.current.retargetNotesInFolder(oldPrefix, newPrefix)
}
