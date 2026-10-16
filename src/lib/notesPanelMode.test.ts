import { afterEach, describe, expect, it } from 'vitest'
import { COMMAND_RAIL_DEFAULT_PINNED, RAIL_COLLAPSED_WIDTH_PX, RAIL_HOVER_OPEN_DELAY_MS } from './railChrome'
import {
  NOTES_PANEL_DEFAULT_MODE,
  canTakeOverlay,
  cycleNotesPanelMode,
  fittedNotesPanelMode,
  isNotesPanelModeShortcut,
  nextOverlaySide,
  notesPanelModeLabel,
  notesPanelModeShortcutAria,
  notesPanelModeStorageKey,
  notesPanelModeTooltip,
  parseNotesPanelMode,
  readNotesPanelMode,
  writeNotesPanelMode,
} from './notesPanelMode'

describe('notes panel mode values', () => {
  it('defaults to Open because CommandRail defaults to pinned', () => {
    expect(COMMAND_RAIL_DEFAULT_PINNED).toBe(true)
    expect(NOTES_PANEL_DEFAULT_MODE).toBe('open')
    expect(parseNotesPanelMode(null)).toBe('open')
    expect(parseNotesPanelMode('nope')).toBe('open')
  })

  it('reuses CommandRail collapsed width and hover-open delay', () => {
    expect(RAIL_COLLAPSED_WIDTH_PX).toBe(46)
    expect(RAIL_HOVER_OPEN_DELAY_MS).toBe(150)
  })

  it('cycles Auto → Rail → Open → Auto', () => {
    expect(cycleNotesPanelMode('auto')).toBe('rail')
    expect(cycleNotesPanelMode('rail')).toBe('open')
    expect(cycleNotesPanelMode('open')).toBe('auto')
  })

  it('uses sentence-case labels and a Panel: tooltip', () => {
    expect(notesPanelModeLabel('auto')).toBe('Auto')
    expect(notesPanelModeLabel('rail')).toBe('Rail')
    expect(notesPanelModeLabel('open')).toBe('Open')
    expect(notesPanelModeTooltip('auto')).toBe('Panel: auto')
    expect(notesPanelModeTooltip('rail')).toBe('Panel: rail')
    expect(notesPanelModeTooltip('open')).toBe('Panel: open')
    expect(notesPanelModeShortcutAria()).toMatch(/Period/)
  })

  it('matches the panel-mode shortcut without extra modifiers', () => {
    const mac = notesPanelModeShortcutAria().startsWith('Meta')
    expect(isNotesPanelModeShortcut({
      key: '.',
      metaKey: mac,
      ctrlKey: !mac,
      altKey: false,
      shiftKey: false,
    })).toBe(true)
    expect(isNotesPanelModeShortcut({
      key: '.',
      metaKey: mac,
      ctrlKey: !mac,
      altKey: true,
      shiftKey: false,
    })).toBe(false)
    expect(isNotesPanelModeShortcut({
      key: '2',
      metaKey: mac,
      ctrlKey: !mac,
      altKey: false,
      shiftKey: false,
    })).toBe(false)
  })
})

describe('per-window persistence', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('stores each window under its own key', () => {
    expect(notesPanelModeStorageKey('main')).toBe('rhizome:notes-panel-mode:main')
    expect(notesPanelModeStorageKey('note-3')).toBe('rhizome:notes-panel-mode:note-3')

    writeNotesPanelMode('main', 'rail')
    writeNotesPanelMode('note-3', 'auto')

    expect(readNotesPanelMode('main')).toBe('rail')
    expect(readNotesPanelMode('note-3')).toBe('auto')
    expect(readNotesPanelMode('other')).toBe('open')
  })
})

describe('narrow-window fallback', () => {
  it('drops Open to Auto when the full panel no longer fits', () => {
    expect(fittedNotesPanelMode('open', false)).toBe('auto')
    expect(fittedNotesPanelMode('open', true)).toBe('open')
    expect(fittedNotesPanelMode('rail', false)).toBe('rail')
    expect(fittedNotesPanelMode('auto', false)).toBe('auto')
  })
})

describe('single-overlay rule', () => {
  it('allows only one side to overlay Chat', () => {
    expect(canTakeOverlay('none', 'right')).toBe(true)
    expect(canTakeOverlay('right', 'right')).toBe(true)
    expect(canTakeOverlay('left', 'right')).toBe(false)
    expect(canTakeOverlay('right', 'left')).toBe(false)
    expect(nextOverlaySide('none', 'right', true)).toBe('right')
    expect(nextOverlaySide('left', 'right', true)).toBe('left')
    expect(nextOverlaySide('right', 'right', false)).toBe('none')
  })
})
