import { wikilinkTarget, wikilinkDisplay } from '../../utils/wikilink'
import type { VaultEntry } from '../../types'
import { getTypeColor, getTypeLightColor } from '../../utils/typeColors'
import { getTypeIcon } from '../NoteItem'
import { findEntryByTarget } from '../../utils/wikilinkColors'

export function isWikilink(value: string): boolean {
  return /^\[\[.*\]\]$/.test(value)
}

export function resolveRef(ref: string, entries: VaultEntry[]): VaultEntry | undefined {
  const target = wikilinkTarget(ref)
  const byTitle = findEntryByTarget(entries, target)
  if (byTitle) return byTitle
  const lastSegment = target.split('/').pop()
  return entries.find((e) => {
    const stem = e.path.replace(/^.*\/Laputa\//, '').replace(/\.md$/, '')
    if (stem === target) return true
    return e.filename.replace(/\.md$/, '') === lastSegment
  })
}

export function entryStatusTitle(entry: VaultEntry | undefined): string | undefined {
  if (entry?.archived) return 'Archived'
  return undefined
}

function resolveRefLabel(ref: string, resolvedTitle: string | undefined): string {
  const displayLabel = wikilinkDisplay(ref)
  if (ref.includes('|')) return displayLabel
  return resolvedTitle ?? displayLabel
}

export function resolveRefProps(ref: string, entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>) {
  const resolved = resolveRef(ref, entries)
  const refType = resolved?.isA ?? null
  const te = typeEntryMap[refType ?? '']
  const icon = resolved?.icon
  return {
    label: resolveRefLabel(ref, resolved?.title),
    noteIcon: icon ?? null,
    typeColor: getTypeColor(refType, te?.color),
    bgColor: getTypeLightColor(refType, te?.color),
    isArchived: resolved?.archived ?? false,
    target: wikilinkTarget(ref),
    title: entryStatusTitle(resolved),
    TypeIcon: getTypeIcon(refType, te?.icon),
  }
}
