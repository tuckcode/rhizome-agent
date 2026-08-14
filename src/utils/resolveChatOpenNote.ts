import { normalizeNotePathSeparators } from './notePathIdentity'

export function resolveChatOpenNote(
  target: string,
  vaultPath?: string | null,
): { path: string; label: string } | null {
  const path = target.trim()
  if (!path) return null

  const label = vaultRelativeLabel(path, vaultPath)
  return { path, label }
}

function vaultRelativeLabel(path: string, vaultPath?: string | null): string {
  if (!vaultPath) return path
  const note = normalizeNotePathSeparators(path)
  const root = normalizeNotePathSeparators(vaultPath).replace(/\/+$/u, '')
  const prefix = `${root}/`
  if (note === root) return path
  if (note.startsWith(prefix)) return note.slice(prefix.length)
  return path
}
