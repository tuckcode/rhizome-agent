import type { ChatNoteSplit } from '../components/chatNoteSplit'
import type { ViewMode } from '../hooks/useViewMode'

export type PanePresetId = 'chat' | 'notes' | 'read' | 'workbench'
export type PaneColumn = 'rail' | 'notes' | 'browse' | 'note'
export type PanePresetState = {
  id: PanePresetId
  widths: Partial<Record<PaneColumn, number>>
  /** Preserve an imported Read layout with its Notes list open. New Read hides it. */
  readNotes?: boolean
}
export const PANE_LIMITS = {
  rail: { min: 180, default: 240, max: 360 },
  notes: { min: 200, default: 240, max: 360 },
  browse: { min: 200, default: 240, max: 320 },
  note: { min: 280, default: 360, max: 480 },
} as const
export const CHAT_MIN_WIDTH = 420
export const RAIL_WIDTH = 46
export const RESTORE_WIDTH = 46
export const NOTE_DIVIDER_WIDTH = 4
export const PANE_PRESET_IDS: PanePresetId[] = ['chat', 'notes', 'read', 'workbench']

export function presetFromLegacy(viewMode: ViewMode, split: ChatNoteSplit): PanePresetState {
  if (viewMode === 'all') return { id: 'workbench', widths: {} }
  if (split === 'side-by-side') return { id: 'read', widths: {}, readNotes: viewMode === 'editor-list' }
  return { id: viewMode === 'editor-list' ? 'notes' : 'chat', widths: {} }
}

export function presetToLegacy(preset: PanePresetState): { viewMode: ViewMode; split: ChatNoteSplit } {
  if (preset.id === 'read') return { viewMode: preset.readNotes ? 'editor-list' : 'editor-only', split: 'side-by-side' }
  return { viewMode: preset.id === 'workbench' ? 'all' : preset.id === 'notes' ? 'editor-list' : 'editor-only', split: 'stacked' }
}

export function normalizedWidths(widths: PanePresetState['widths']): Record<PaneColumn, number> {
  const clamp = (key: PaneColumn) => {
    const value = widths[key]
    const limits = PANE_LIMITS[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(limits.min, Math.min(limits.max, value)) : limits.default
  }
  return { rail: clamp('rail'), notes: clamp('notes'), browse: clamp('browse'), note: clamp('note') }
}

export type PaneFitContext = {
  shellWidth: number | null
  noteOpen?: boolean
  railPinned?: boolean
  hideNotesForCanvas?: boolean
}

/** Fit actual columns, including both rails. Shrinking never overwrites saved widths. */
export function fitPanePreset(preset: PanePresetState, context: PaneFitContext) {
  const widths = normalizedWidths(preset.widths)
  const legacy = presetToLegacy(preset)
  let notesOpen = legacy.viewMode !== 'editor-only' && !context.hideNotesForCanvas
  let browseOpen = preset.id === 'workbench' && notesOpen
  let railPinned = context.railPinned === true
  let beside = preset.id === 'read' && context.noteOpen === true
  const available = context.shellWidth && context.shellWidth > 0 ? context.shellWidth : Infinity
  const used = () => (railPinned ? widths.rail : RAIL_WIDTH)
    + (notesOpen ? widths.notes : context.hideNotesForCanvas ? 0 : RESTORE_WIDTH)
    + (browseOpen ? widths.browse : 0)
    + (beside ? widths.note + NOTE_DIVIDER_WIDTH : 0)
  const active = (key: PaneColumn) => key === 'rail' ? railPinned : key === 'notes' ? notesOpen : key === 'browse' ? browseOpen : beside
  // Use each column's legal range before folding it.
  for (const key of ['browse', 'notes', 'rail', 'note'] as const) {
    if (active(key)) widths[key] = Math.max(PANE_LIMITS[key].min, widths[key] - Math.max(0, used() + CHAT_MIN_WIDTH - available))
  }
  if (used() + CHAT_MIN_WIDTH > available) browseOpen = false
  if (used() + CHAT_MIN_WIDTH > available) notesOpen = false
  if (used() + CHAT_MIN_WIDTH > available) railPinned = false
  if (used() + CHAT_MIN_WIDTH > available) beside = false
  return {
    widths, notesOpen, browseOpen, railPinned,
    split: (beside ? 'side-by-side' : 'stacked') as ChatNoteSplit,
    showRestoreStrip: !notesOpen && !context.hideNotesForCanvas,
    chatWidth: available - used(),
  }
}

/** A drag cannot steal the space occupied by another column or Chat. */
export function resizePresetWidth(preset: PanePresetState, column: PaneColumn, requested: number, context: PaneFitContext): PanePresetState {
  const fit = fitPanePreset(preset, context)
  const available = fit.widths[column] + Math.max(0, fit.chatWidth - CHAT_MIN_WIDTH)
  const width = normalizedWidths({ [column]: Math.min(requested, available) })[column]
  return { ...preset, widths: { ...preset.widths, [column]: width } }
}
