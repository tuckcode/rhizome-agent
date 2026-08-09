import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { resolveEntry } from '../utils/wikilink'
import {
  chipToken,
  normalizeInlineWikilinkValue,
  toInlineWikilinkTarget,
} from './inlineWikilinkTokens'

export interface InlineWikilinkChip {
  entry: VaultEntry
  target: string
}

export type InlineWikilinkSegment =
  | { kind: 'text'; text: string }
  | { kind: 'chip'; chip: InlineWikilinkChip }

export interface ActiveWikilinkQuery {
  start: number
  query: string
}

const INLINE_WIKILINK_PATTERN = /\[\[([^[\]\r\n]+?)\]\]/g

export function buildInlineWikilinkSegments(
  value: string,
  entries: VaultEntry[],
): InlineWikilinkSegment[] {
  const normalizedValue = normalizeInlineWikilinkValue(value)
  const segments: InlineWikilinkSegment[] = []
  let cursor = 0

  INLINE_WIKILINK_PATTERN.lastIndex = 0
  for (const match of normalizedValue.matchAll(INLINE_WIKILINK_PATTERN)) {
    const fullMatch = match[0]
    const target = match[1]
    const start = match.index ?? 0

    if (start > cursor) {
      segments.push({ kind: 'text', text: normalizedValue.slice(cursor, start) })
    }

    const entry = resolveEntry(entries, target)
    if (!entry) {
      segments.push({ kind: 'text', text: fullMatch })
    } else {
      segments.push({
        kind: 'chip',
        chip: { entry, target: toInlineWikilinkTarget(entry) },
      })
    }
    cursor = start + fullMatch.length
  }

  if (cursor < normalizedValue.length) {
    segments.push({ kind: 'text', text: normalizedValue.slice(cursor) })
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text: '' }]
}

export function extractInlineWikilinkReferences(
  value: string,
  entries: VaultEntry[],
): NoteReference[] {
  const references: NoteReference[] = []
  const seenPaths = new Set<string>()

  for (const segment of buildInlineWikilinkSegments(value, entries)) {
    if (segment.kind !== 'chip') continue
    if (seenPaths.has(segment.chip.entry.path)) continue

    seenPaths.add(segment.chip.entry.path)
    references.push({
      title: segment.chip.entry.title,
      path: segment.chip.entry.path,
      type: segment.chip.entry.isA,
    })
  }

  return references
}

function hasClosedQuery(openText: string): boolean {
  return openText.includes(']]') || /[\r\n]/.test(openText)
}

export function findActiveWikilinkQuery(
  value: string,
  selectionIndex: number,
): ActiveWikilinkQuery | null {
  const clampedIndex = Math.max(0, Math.min(selectionIndex, value.length))
  const textBeforeCursor = value.slice(0, clampedIndex)
  const triggerStart = textBeforeCursor.lastIndexOf('[[')

  if (triggerStart < 0) return null

  const openText = textBeforeCursor.slice(triggerStart + 2)
  if (hasClosedQuery(openText)) return null

  return { start: triggerStart, query: openText }
}

export function replaceActiveWikilinkQuery(
  value: string,
  selectionIndex: number,
  target: string,
): { value: string; nextSelectionIndex: number } | null {
  const activeQuery = findActiveWikilinkQuery(value, selectionIndex)
  if (!activeQuery) return null

  const token = chipToken(target)
  return {
    value: value.slice(0, activeQuery.start) + token + value.slice(selectionIndex),
    nextSelectionIndex: activeQuery.start + token.length,
  }
}

function segmentLength(segment: InlineWikilinkSegment): number {
  return segment.kind === 'text'
    ? segment.text.length
    : chipToken(segment.chip.target).length
}

export function findInlineChipDeletionRange(
  segments: InlineWikilinkSegment[],
  selectionIndex: number,
  direction: 'backward' | 'forward',
): { start: number; end: number } | null {
  let cursor = 0

  for (const segment of segments) {
    const nextCursor = cursor + segmentLength(segment)

    if (segment.kind === 'chip') {
      const removePreviousChip = direction === 'backward' && selectionIndex === nextCursor
      const removeNextChip = direction === 'forward' && selectionIndex === cursor

      if (removePreviousChip || removeNextChip) {
        return { start: cursor, end: nextCursor }
      }
    }

    cursor = nextCursor
  }

  return null
}
