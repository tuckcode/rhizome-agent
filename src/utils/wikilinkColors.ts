/**
 * Wikilink color resolution: maps wikilink targets to their note-type accent color.
 * Used by the WikiLink inline content renderer in the editor.
 */
import type { VaultEntry } from '../types'
import { getTypeColor } from './typeColors'
import { resolveEntry } from './wikilink'

/** Broken-link color: muted text to signal the target note doesn't exist */
const BROKEN_LINK_COLOR = 'var(--text-muted)'
const typeEntriesByEntries = new WeakMap<VaultEntry[], Map<string, VaultEntry>>()

function typeEntryMapForEntries(entries: VaultEntry[]): Map<string, VaultEntry> {
  const cached = typeEntriesByEntries.get(entries)
  if (cached) return cached

  const typeEntries = new Map<string, VaultEntry>()
  for (const entry of entries) {
    if (entry.isA === 'Type') typeEntries.set(entry.title, entry)
  }
  typeEntriesByEntries.set(entries, typeEntries)
  return typeEntries
}

/** Find a vault entry matching a wikilink target string.
 *  Delegates to the unified resolveEntry for consistent case-insensitive matching. */
export function findEntryByTarget(entries: VaultEntry[], target: string): VaultEntry | undefined {
  return resolveEntry(entries, target)
}

/** Resolve the accent color for a given entry based on its type */
export function lookupColorForEntry(entries: VaultEntry[], entry: VaultEntry): string {
  if (!entry.isA) return getTypeColor(null)
  const typeEntry = typeEntryMapForEntries(entries).get(entry.isA)
  return getTypeColor(entry.isA, typeEntry?.color)
}

export interface WikilinkColorResult { color: string; isBroken: boolean }

/** Resolve the display color for a wikilink target */
export function resolveWikilinkColor(entries: VaultEntry[], target: string): WikilinkColorResult {
  if (!entries.length) return { color: getTypeColor(null), isBroken: false }
  const entry = findEntryByTarget(entries, target)
  if (!entry) return { color: BROKEN_LINK_COLOR, isBroken: true }
  return { color: lookupColorForEntry(entries, entry), isBroken: false }
}
