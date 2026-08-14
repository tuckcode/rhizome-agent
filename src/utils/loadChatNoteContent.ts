import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { joinVaultPath } from './notePathIdentity'

export async function loadChatNoteContent(path: string, vaultPath: string): Promise<string> {
  const absolute = isAbsoluteNotePath(path) ? path : joinVaultPath(vaultPath, path)
  const args = { path: absolute, vaultPath }
  return isTauri()
    ? invoke<string>('get_note_content', args)
    : mockInvoke<string>('get_note_content', args)
}

function isAbsoluteNotePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(path)
}
