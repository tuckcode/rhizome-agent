import { isMac } from '../utils/platform'

/**
 * One label for a chord. Mac keeps the glyph form (⌘K, ⌘,, ⌃⌘1).
 * Other platforms use the words passed in (Ctrl+K, Ctrl+,, Ctrl+Shift+1).
 */
export function platformShortcutLabel(macLabel: string, otherLabel: string): string {
  return isMac() ? macLabel : otherLabel
}
