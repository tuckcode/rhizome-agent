import { isMac } from '../utils/platform'
import type { AppCommandShortcutCombo } from '../hooks/appCommandCatalog'
import { RAIL_VIEWS, type RailViewId } from './railViews'

/**
 * View shortcut policy.
 *
 * knispo is still choosing the Mac combo. Option+Cmd+1–5 collides with
 * BlockNote headings because the native menu grabs it first. Swap
 * `MAC_VIEW_SHORTCUT_POLICY` when he calls it. Until then Mac stays
 * Option+Cmd.
 *
 * Windows/Linux must not use Ctrl+Alt+digit. That chord is AltGr on many
 * layouts and eats characters (superscript 2 and 3). Those platforms use
 * Ctrl+Shift+1–5.
 */
export interface ViewShortcutPolicy {
  combo: AppCommandShortcutCombo
  displayPrefix: string
  ariaPrefix: string
}

export const MAC_VIEW_SHORTCUT_POLICY: ViewShortcutPolicy = {
  combo: 'command-or-ctrl-alt',
  displayPrefix: '⌥⌘',
  ariaPrefix: 'Alt+Meta+',
}

export const OTHER_VIEW_SHORTCUT_POLICY: ViewShortcutPolicy = {
  combo: 'command-or-ctrl-shift',
  displayPrefix: 'Ctrl+Shift+',
  ariaPrefix: 'Control+Shift+',
}

export function viewShortcutPolicy(): ViewShortcutPolicy {
  return isMac() ? MAC_VIEW_SHORTCUT_POLICY : OTHER_VIEW_SHORTCUT_POLICY
}

export function railViewShortcutDisplay(shortcutNumber: 1 | 2 | 3 | 4 | 5): string {
  return `${viewShortcutPolicy().displayPrefix}${shortcutNumber}`
}

export function railViewShortcutAria(shortcutNumber: 1 | 2 | 3 | 4 | 5): string {
  return `${viewShortcutPolicy().ariaPrefix}${shortcutNumber}`
}

export function railButtonAccessibleName(label: string, badge?: number): string {
  if (badge && badge > 0) return `${label}, ${badge}`
  return label
}

const VIEW_COMMAND_BY_NUMBER = new Map(
  RAIL_VIEWS.map((view) => [String(view.shortcutNumber), view.commandId] as const),
)

export function railViewCommandIdForNumber(key: string): string | null {
  return VIEW_COMMAND_BY_NUMBER.get(key) ?? null
}

export function isRailViewCommandId(commandId: string): boolean {
  return RAIL_VIEWS.some((view) => view.commandId === commandId)
}

export function railViewIdForCommandId(commandId: string): RailViewId | null {
  return RAIL_VIEWS.find((view) => view.commandId === commandId)?.id ?? null
}

export function railViewShortcutDisplayForCommand(commandId: string): string | null {
  const view = RAIL_VIEWS.find((item) => item.commandId === commandId)
  return view ? railViewShortcutDisplay(view.shortcutNumber) : null
}

/** Modifiers for a synthesized view chord. Swap happens in the policy objects. */
export function viewShortcutEventModifiers(): { altKey: boolean; shiftKey: boolean } {
  const combo = viewShortcutPolicy().combo
  return {
    altKey: combo === 'command-or-ctrl-alt',
    shiftKey: combo === 'command-or-ctrl-shift',
  }
}

function eventCombo(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): AppCommandShortcutCombo | null {
  const commandHeld = isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (!commandHeld) return null
  if (event.altKey && event.shiftKey) return null
  if (event.altKey) return 'command-or-ctrl-alt'
  if (event.shiftKey) return 'command-or-ctrl-shift'
  return 'command-or-ctrl'
}

function digitFromEvent(event: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (/^[1-5]$/.test(event.key)) return event.key
  const match = /^Digit([1-5])$/.exec(event.code ?? '')
  return match?.[1] ?? null
}

/**
 * Match a view chord, or reject Ctrl+Alt+digit on non-Mac so AltGr cannot
 * fall through to the shared catalog map.
 */
export function matchRailViewShortcutEvent(
  event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key' | 'code'>,
): string | null | undefined {
  const digit = digitFromEvent(event)
  if (!digit) return undefined

  const combo = eventCombo(event)
  if (!combo) return undefined

  const policy = viewShortcutPolicy()
  if (combo === policy.combo) return railViewCommandIdForNumber(digit)
  if (combo === 'command-or-ctrl-alt' && policy.combo !== 'command-or-ctrl-alt') return null
  return undefined
}
