import { commandHasHiddenChars, visibleCommandParts } from './visibleCommand'
import { sliceGraphemes } from './graphemeSlice'

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
  const empty = display.length === 0
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

export function approvalAriaLabel(actionLabel: string, display: string): string {
  const escaped = escapeApprovalLabel(display)
  return escaped ? `${actionLabel}: ${escaped}` : actionLabel
}

export function collapsePathKeepFilename(path: string, max = 40): string {
  if ([...path].length <= max) return path
  const parts = path.replace(/\\/gu, '/').split('/')
  const file = parts.pop() || path
  let kept = file
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const next = `${parts[index]}/${kept}`
    if ([...`…/${next}`].length > max) break
    kept = next
  }
  return `…/${kept}`
}
