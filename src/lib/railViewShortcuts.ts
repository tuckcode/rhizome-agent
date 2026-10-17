import { platformShortcutLabel } from './platformShortcutLabel'
import { isMac } from '../utils/platform'
import type { AppCommandShortcutCombo } from '../hooks/appCommandCatalog'
import { RAIL_VIEWS, type RailViewId } from './railViews'

/**
 * View shortcut policy.
 *
 * Mac is Ctrl+Cmd+1–4 (knispo, 2026-10-11). That leaves BlockNote's
 * Option+Cmd heading shortcuts alone. Windows/Linux stay Ctrl+Shift+1–4;
 * Ctrl+Alt+digit is AltGr on many layouts and must not be used.
 */
export interface ViewShortcutPolicy {
  combo: AppCommandShortcutCombo
  displayPrefix: string
  ariaPrefix: string
}

export const MAC_VIEW_SHORTCUT_POLICY: ViewShortcutPolicy = {
  combo: 'command-and-ctrl',
  displayPrefix: '⌃⌘',
  ariaPrefix: 'Control+Meta+',
}

export const OTHER_VIEW_SHORTCUT_POLICY: ViewShortcutPolicy = {
  combo: 'command-or-ctrl-shift',
  displayPrefix: 'Ctrl+Shift+',
  ariaPrefix: 'Control+Shift+',
}

export function viewShortcutPolicy(): ViewShortcutPolicy {
  return isMac() ? MAC_VIEW_SHORTCUT_POLICY : OTHER_VIEW_SHORTCUT_POLICY
}

export function railViewShortcutDisplay(shortcutNumber: 1 | 2 | 3 | 4): string {
  return platformShortcutLabel(
    `${MAC_VIEW_SHORTCUT_POLICY.displayPrefix}${shortcutNumber}`,
    `${OTHER_VIEW_SHORTCUT_POLICY.displayPrefix}${shortcutNumber}`,
  )
}

export function railViewShortcutAria(shortcutNumber: 1 | 2 | 3 | 4): string {
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

/** Modifiers for a synthesized view chord. */
export function viewShortcutEventModifiers(): {
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
} {
  if (viewShortcutPolicy().combo === 'command-and-ctrl') {
    return { altKey: false, shiftKey: false, ctrlKey: true, metaKey: true }
  }
  return { altKey: false, shiftKey: true, ctrlKey: true, metaKey: false }
}

function eventCombo(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): AppCommandShortcutCombo | null {
  if (event.altKey && event.shiftKey) return null

  if (isMac()) {
    if (event.metaKey && event.ctrlKey && !event.altKey && !event.shiftKey) return 'command-and-ctrl'
    if (!event.metaKey || event.ctrlKey) return null
    if (event.altKey) return 'command-or-ctrl-alt'
    if (event.shiftKey) return 'command-or-ctrl-shift'
    return 'command-or-ctrl'
  }

  if (!event.ctrlKey || event.metaKey) return null
  if (event.altKey) return 'command-or-ctrl-alt'
  if (event.shiftKey) return 'command-or-ctrl-shift'
  return 'command-or-ctrl'
}

function digitFromEvent(event: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  if (/^[1-4]$/.test(event.key)) return event.key
  const match = /^Digit([1-4])$/.exec(event.code ?? '')
  return match?.[1] ?? null
}

/**
 * Match a view chord. Rejects Option+Cmd+digit on Mac (BlockNote headings)
 * and Ctrl+Alt+digit on Windows/Linux (AltGr).
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
  if (combo === 'command-or-ctrl-alt') return null
  return undefined
}
