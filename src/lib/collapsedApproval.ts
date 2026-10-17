import { commandHasHiddenChars } from './visibleCommand'

/**
 * Conservative visible-character budget for a collapsed approval row.
 * jsdom cannot measure scroll overflow reliably, so we refuse Allow once
 * the display string is longer than this, or if it contains hidden
 * characters (badges can push the tail off the row).
 */
export const COLLAPSED_COMMAND_VISIBLE_CHARS = 48

export function collapsedApprovalOverflow(display: string): {
  review: boolean
  moreChars: number
  hiddenChars: boolean
} {
  const hiddenChars = commandHasHiddenChars(display)
  const moreChars = Math.max(0, [...display].length - COLLAPSED_COMMAND_VISIBLE_CHARS)
  return {
    review: hiddenChars || moreChars > 0,
    moreChars,
    hiddenChars,
  }
}
