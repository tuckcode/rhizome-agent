import { commandHasHiddenChars, visibleCommandParts } from './visibleCommand'
import { segmentGraphemes, sliceGraphemes } from './graphemeSlice'

/**
 * Conservative visible-character budget for a collapsed approval row.
 * jsdom cannot measure scroll overflow reliably, so we refuse Allow once
 * the display string is longer than this, contains a newline, is empty,
 * or has hidden characters (badges can push the tail off the row).
 */
export const COLLAPSED_COMMAND_VISIBLE_CHARS = 48
export const APPROVAL_ARIA_LABEL_MAX = 80

export function collapsedApprovalOverflow(display: string): {
  review: boolean
  long: boolean
  hiddenChars: boolean
  hasNewline: boolean
  empty: boolean
} {
  const empty = display.trim().length === 0
  const hiddenChars = commandHasHiddenChars(display)
  const hasNewline = display.includes('\n')
  const long = [...display].length > COLLAPSED_COMMAND_VISIBLE_CHARS
  return {
    review: empty || hiddenChars || hasNewline || long,
    long,
    hiddenChars,
    hasNewline,
    empty,
  }
}

export function approvalOverflowTag(overflow: {
  empty: boolean
  hasNewline: boolean
  long: boolean
}): 'Multiple lines' | 'Long command' | null {
  if (overflow.empty) return null
  if (overflow.hasNewline) return 'Multiple lines'
  if (overflow.long) return 'Long command'
  return null
}

export function escapeApprovalLabel(
  command: string,
  max = APPROVAL_ARIA_LABEL_MAX,
): string {
  const raw = visibleCommandParts(command).map((part) => {
    if (part.kind === 'text') return part.text
    if (part.kind === 'newline') return '⏎'
    return `\\u{${part.hex}}`
  }).join('')
  return sliceGraphemes(raw, max)
}

/**
 * The accessible name of a row button. `notes` are the risk and overflow
 * tags, which sit in their own spans and would otherwise go unread.
 */
export function approvalAriaLabel(actionLabel: string, display: string, notes: Array<string | null> = []): string {
  const escaped = display.trim() ? escapeApprovalLabel(display) : ''
  const base = escaped ? `${actionLabel}: ${escaped}` : actionLabel
  const extra = notes.filter((note): note is string => Boolean(note))
  return extra.length > 0 ? `${base}. ${extra.join('. ')}` : base
}

function middleTruncateFilename(file: string, max: number): string {
  const parts = segmentGraphemes(file)
  if (parts.length <= max) return file
  const lastDot = file.lastIndexOf('.')
  const ext = lastDot > 0 ? file.slice(lastDot) : ''
  const extParts = segmentGraphemes(ext)
  const startBudget = max - 1 - extParts.length
  if (startBudget < 1) return sliceGraphemes(file, max)
  const stem = lastDot > 0 ? file.slice(0, lastDot) : file
  return `${segmentGraphemes(stem).slice(0, startBudget).join('')}…${ext}`
}

export function collapsePathKeepFilename(path: string, max = 40): string {
  if ([...path].length <= max) return path
  const parts = path.replace(/\\/gu, '/').split('/')
  const file = parts.pop() || path
  if ([...file].length >= max) return middleTruncateFilename(file, max)
  let kept = file
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const next = `${parts[index]}/${kept}`
    if ([...`…/${next}`].length > max) break
    kept = next
  }
  return `…/${kept}`
}
