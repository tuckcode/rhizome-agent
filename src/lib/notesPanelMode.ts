import { ArrowsHorizontal, Sidebar, SidebarSimple } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { COMMAND_RAIL_DEFAULT_PINNED } from './railChrome'
import { isMac } from '../utils/platform'

export const NOTES_PANEL_MODES = ['auto', 'rail', 'open'] as const
export type NotesPanelMode = (typeof NOTES_PANEL_MODES)[number]

export type OverlaySide = 'none' | 'left' | 'right'

export const NOTES_PANEL_MODE_STORAGE_PREFIX = 'rhizome:notes-panel-mode'
export const NOTES_PANEL_DEFAULT_WINDOW_ID = 'main'

export const NOTES_PANEL_MODE_ICONS: Record<NotesPanelMode, Icon> = {
  auto: ArrowsHorizontal,
  rail: SidebarSimple,
  open: Sidebar,
}

/**
 * CommandRail starts pinned. The notes panel matches that default (Open)
 * instead of inventing Auto as a second first-run state.
 */
export const NOTES_PANEL_DEFAULT_MODE: NotesPanelMode = COMMAND_RAIL_DEFAULT_PINNED
  ? 'open'
  : 'auto'

export function notesPanelModeStorageKey(windowId: string = NOTES_PANEL_DEFAULT_WINDOW_ID): string {
  return `${NOTES_PANEL_MODE_STORAGE_PREFIX}:${windowId}`
}

export function isNotesPanelMode(value: unknown): value is NotesPanelMode {
  return value === 'auto' || value === 'rail' || value === 'open'
}

export function parseNotesPanelMode(
  raw: string | null,
  fallback: NotesPanelMode = NOTES_PANEL_DEFAULT_MODE,
): NotesPanelMode {
  return isNotesPanelMode(raw) ? raw : fallback
}

export function readNotesPanelMode(
  windowId: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): NotesPanelMode {
  try {
    return parseNotesPanelMode(storage.getItem(notesPanelModeStorageKey(windowId)))
  } catch {
    return NOTES_PANEL_DEFAULT_MODE
  }
}

export function writeNotesPanelMode(
  windowId: string,
  mode: NotesPanelMode,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(notesPanelModeStorageKey(windowId), mode)
  } catch {
    // A machine that refuses storage still gets the live toggle.
  }
}

export function cycleNotesPanelMode(mode: NotesPanelMode): NotesPanelMode {
  const index = NOTES_PANEL_MODES.indexOf(mode)
  return NOTES_PANEL_MODES[(index + 1) % NOTES_PANEL_MODES.length]
}

export function notesPanelModeLabel(mode: NotesPanelMode): string {
  if (mode === 'auto') return 'Auto'
  if (mode === 'rail') return 'Rail'
  return 'Open'
}

export function notesPanelModeTooltip(
  mode: NotesPanelMode,
  options: { windowTooNarrow?: boolean; openForNow?: boolean } = {},
): string {
  const base = `Panel: ${notesPanelModeLabel(mode)}`
  if (options.windowTooNarrow) return `${base} (window too narrow)`
  if (options.openForNow) return `${base} (open for now)`
  return base
}

export function notesPanelModeShortcutDisplay(): string {
  // macOS Command-Period is Cancel. Shift keeps this off that chord.
  return isMac() ? '⌘⇧.' : 'Ctrl+Shift+.'
}

export function notesPanelModeShortcutAria(): string {
  return isMac() ? 'Meta+Shift+Period' : 'Control+Shift+Period'
}

export function isNotesPanelModeShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'> & { code?: string },
): boolean {
  // Shift+Period types '>' on a US keyboard. Match the physical key.
  if (event.code !== 'Period') return false
  if (event.altKey || !event.shiftKey) return false
  return isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}

/**
 * Narrow windows fold Open to Auto first. The stored choice is unchanged.
 */
export function fittedNotesPanelMode(stored: NotesPanelMode, notesOpenFits: boolean): NotesPanelMode {
  if (stored === 'open' && !notesOpenFits) return 'auto'
  return stored
}

/**
 * Only one side may overlay Chat. A second overlay request is refused.
 */
export function canTakeOverlay(current: OverlaySide, requested: OverlaySide): boolean {
  if (requested === 'none') return true
  return current === 'none' || current === requested
}

export function nextOverlaySide(current: OverlaySide, side: OverlaySide, overlaying: boolean): OverlaySide {
  if (overlaying) {
    return canTakeOverlay(current, side) ? side : current
  }
  return current === side ? 'none' : current
}

export function resolveNotesPanelWindowId(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('windowLabel')
    if (fromQuery) return fromQuery
    const internals = (window as Window & {
      __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } }
    }).__TAURI_INTERNALS__
    const label = internals?.metadata?.currentWindow?.label
    if (typeof label === 'string' && label.length > 0) return label
  } catch {
    // Browser tests and locked-down webviews still get the main scope.
  }
  return NOTES_PANEL_DEFAULT_WINDOW_ID
}
