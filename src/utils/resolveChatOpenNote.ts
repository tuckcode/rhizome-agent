import { normalizeNotePathSeparators } from './notePathIdentity'
import { resolveEntry } from './wikilink'
import type { VaultEntry } from '../types'

export function resolveChatOpenNote(
  target: string,
  vaultPath?: string | null,
  entries: VaultEntry[] = [],
): { path: string; label: string } | null {
  const raw = target.trim()
  if (!raw) return null

  const hit = entries.length > 0 ? resolveEntry(entries, raw) : undefined
  const path = hit?.path ?? raw
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
