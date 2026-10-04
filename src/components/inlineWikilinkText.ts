import type { VaultEntry } from '../types'
import type { NoteReference } from '../utils/ai-context'
import { decodeReplyQuote } from '../lib/replyQuote'
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

export interface InlineReplyQuote {
  messageId: string
  text: string
  token: string
}

export type InlineWikilinkSegment =
  | { kind: 'text'; text: string }
  | { kind: 'chip'; chip: InlineWikilinkChip }
  | { kind: 'quote'; quote: InlineReplyQuote }

export interface ActiveWikilinkQuery {
  start: number
  query: string
}

const INLINE_WIKILINK_PATTERN = /\[\[([^[\]\r\n]+?)\]\]/g
const REPLY_QUOTE_PATTERN = /«quote:([^»]*)»/g

export function buildInlineWikilinkSegments(
  value: string,
  entries: VaultEntry[],
): InlineWikilinkSegment[] {
  const normalizedValue = normalizeInlineWikilinkValue(value)
  const segments: InlineWikilinkSegment[] = []
  let cursor = 0

  REPLY_QUOTE_PATTERN.lastIndex = 0
  for (const match of normalizedValue.matchAll(REPLY_QUOTE_PATTERN)) {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push(...wikilinkSegments(normalizedValue.slice(cursor, start), entries))
    }
    const token = match[0]
    const quote = decodeReplyQuote(match[1])
    segments.push(quote
      ? { kind: 'quote', quote: { messageId: quote.messageId, text: quote.text, token } }
      : { kind: 'text', text: token })
    cursor = start + token.length
  }

  if (cursor < normalizedValue.length) {
    segments.push(...wikilinkSegments(normalizedValue.slice(cursor), entries))
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text: '' }]
}

function wikilinkSegments(normalizedValue: string, entries: VaultEntry[]): InlineWikilinkSegment[] {
  if (normalizedValue.length === 0) return []
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

  return segments
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
  if (segment.kind === 'text') return segment.text.length
  if (segment.kind === 'quote') return segment.quote.token.length
  return chipToken(segment.chip.target).length
}

export function findInlineChipDeletionRange(
  segments: InlineWikilinkSegment[],
  selectionIndex: number,
  direction: 'backward' | 'forward',
): { start: number; end: number } | null {
  let cursor = 0

  for (const segment of segments) {
    const nextCursor = cursor + segmentLength(segment)

    if (segment.kind === 'chip' || segment.kind === 'quote') {
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
