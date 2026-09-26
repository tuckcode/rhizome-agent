import { beforeEach, describe, expect, it } from 'vitest'
import { loadPanePreferences, panePresetStorageKey } from './panePresetStorage'
import { fitPanePreset, presetFromLegacy, presetToLegacy, resizePresetWidth } from './panePresets'

describe('pane presets', () => {
  // Native audit 2026-09-26: opening a note makes the research desk (note
  // beside Chat) whenever there is room, in every preset.
  it.each([
    ['chat', false, false, 'side-by-side'],
    ['notes', true, false, 'side-by-side'],
    ['read', false, false, 'side-by-side'],
    ['workbench', true, true, 'side-by-side'],
  ] as const)('%s selects its legal columns', (id, notesOpen, browseOpen, split) => {
    const fit = fitPanePreset({ id, widths: {} }, { shellWidth: 1600, noteOpen: true })
    expect(fit).toMatchObject({ notesOpen, browseOpen, split, showRestoreStrip: !notesOpen })
    expect(fit.chatWidth).toBeGreaterThanOrEqual(420)
  })

  it.each(['editor-only', 'editor-list', 'all'] as const)('round trips %s', viewMode => {
    expect(presetToLegacy(presetFromLegacy(viewMode, 'stacked')).viewMode).toBe(viewMode)
  })

  it.each(['editor-only', 'editor-list'] as const)('preserves %s with a beside note during migration', viewMode => {
    expect(presetToLegacy(presetFromLegacy(viewMode, 'side-by-side'))).toEqual({ viewMode, split: 'side-by-side' })
  })

  it('folds Browse, Notes, then the pinned rail without changing the preset', () => {
    const preset = { id: 'workbench', widths: {} } as const
    expect(fitPanePreset(preset, { shellWidth: 940, railPinned: true })).toMatchObject({ browseOpen: false, notesOpen: true, railPinned: true })
    expect(fitPanePreset(preset, { shellWidth: 740, railPinned: true })).toMatchObject({ browseOpen: false, notesOpen: false, railPinned: true })
    expect(fitPanePreset(preset, { shellWidth: 639, railPinned: true })).toMatchObject({ browseOpen: false, notesOpen: false, railPinned: false })
    expect(preset.id).toBe('workbench')
  })

  it('accounts for the rail at the exact Notes floor', () => {
    const preset = { id: 'notes', widths: {} } as const
    expect(fitPanePreset(preset, { shellWidth: 639 }).notesOpen).toBe(false)
    expect(fitPanePreset(preset, { shellWidth: 640 }).chatWidth).toBeGreaterThanOrEqual(420)
    expect(fitPanePreset(preset, { shellWidth: 666 })).toMatchObject({ notesOpen: true, chatWidth: 420 })
  })

  it('clamps a width drag before it consumes Chat', () => {
    const preset = { id: 'notes', widths: { notes: 240 } } as const
    const next = resizePresetWidth(preset, 'notes', 360, { shellWidth: 720 })
    expect(next.widths.notes).toBe(254)
    expect(fitPanePreset(next, { shellWidth: 720 }).chatWidth).toBe(420)
  })

  it('does not let siblings keep leftover from a beside-note shrink', () => {
    const context = { shellWidth: 1000, noteOpen: true }
    const start = resizePresetWidth({ id: 'read', widths: { note: 360 }, readNotes: true }, 'note', 360, context)
    const shrunk = resizePresetWidth(start, 'note', (start.widths.note ?? 360) - 24, context)
    const restored = resizePresetWidth(shrunk, 'note', (shrunk.widths.note ?? 0) + 24, context)
    expect(start.widths.note).toBe(330)
    expect(shrunk.widths.note).toBe(306)
    expect(restored.widths.note).toBe(330)
  })

  it('does not ratchet a tight beside-note through +N then -N repeats', () => {
    const context = { shellWidth: 1000, noteOpen: true }
    let preset = resizePresetWidth({ id: 'read', widths: { note: 360 }, readNotes: true }, 'note', 360, context)
    const grown = resizePresetWidth(preset, 'note', (preset.widths.note ?? 360) + 12, context)
    const afterFirstMinus = resizePresetWidth(grown, 'note', (grown.widths.note ?? 360) - 12, context)
    preset = afterFirstMinus
    for (let i = 0; i < 8; i += 1) {
      const base = preset.widths.note ?? 0
      preset = resizePresetWidth(preset, 'note', base + 12, context)
      preset = resizePresetWidth(preset, 'note', (preset.widths.note ?? 0) - 12, context)
    }
    expect(preset.widths.note).toBe(afterFirstMinus.widths.note)
    expect(preset.widths.note).toBeGreaterThan(300)
  })

  it('switches Read to the focused window when the note cannot fit beside Chat', () => {
    expect(fitPanePreset({ id: 'read', widths: {} }, { shellWidth: 639, noteOpen: true }))
      .toMatchObject({ split: 'stacked', chatWidth: 547, workspace: 'focused' })
  })
})

/**
 * Astra's three layout directions (native audit 2026-09-26) as states of one
 * workspace. Transitions come from content fit — Chat's and the note's
 * minimum widths — not from device labels.
 */
describe('workspace states', () => {
  it('is conversation-first with no note open', () => {
    expect(fitPanePreset({ id: 'chat', widths: {} }, { shellWidth: 1600 }).workspace).toBe('conversation')
  })

  it('becomes the research desk when a note opens and there is room', () => {
    const fit = fitPanePreset({ id: 'chat', widths: {} }, { shellWidth: 1200, noteOpen: true })
    expect(fit).toMatchObject({ workspace: 'desk', split: 'side-by-side' })
    expect(fit.chatWidth).toBeGreaterThanOrEqual(420)
  })

  it('does not fold the Notes list to make a desk; it focuses instead', () => {
    // 46 rail + 240 notes + 284 note + 420 chat = 990 > 900.
    const fit = fitPanePreset({ id: 'notes', widths: {} }, { shellWidth: 900, noteOpen: true })
    expect(fit).toMatchObject({ notesOpen: true, workspace: 'focused' })
  })

  it('narrows the desk note to fit before giving up on the desk', () => {
    // 46 + 46 restore + 420 chat leaves 288 for divider + note at 800.
    const fit = fitPanePreset({ id: 'chat', widths: {} }, { shellWidth: 800, noteOpen: true })
    expect(fit).toMatchObject({ workspace: 'desk' })
    expect(fit.widths.note).toBe(284)
    expect(fit.chatWidth).toBe(420)
  })

  it('keeps an explicit On top choice while it fits', () => {
    expect(fitPanePreset({ id: 'chat', widths: {}, stacked: true }, { shellWidth: 1600, noteOpen: true }))
      .toMatchObject({ workspace: 'stacked', split: 'stacked' })
  })

  it('uses tabs instead of squeezing two panes in a small window', () => {
    expect(fitPanePreset({ id: 'chat', widths: {} }, { shellWidth: 700, noteOpen: true }).workspace).toBe('focused')
    expect(fitPanePreset({ id: 'chat', widths: {}, stacked: true }, { shellWidth: 700, noteOpen: true }).workspace).toBe('focused')
  })
})

describe('loadPanePreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns Chat on a clean store', () => {
    expect(loadPanePreferences('/Vault').active.id).toBe('chat')
  })

  it('ignores leftover vault view_mode when the v1 key is missing', () => {
    localStorage.setItem('rhizome:vault-config:/Vault', JSON.stringify({ view_mode: 'editor-list' }))
    expect(loadPanePreferences('/Vault')).toEqual({
      version: 1,
      active: { id: 'chat', widths: {} },
      savedWidths: {},
    })
  })

  it('ignores leftover rhizome-view-mode when the v1 key is missing', () => {
    localStorage.setItem('rhizome-view-mode', 'editor-list')
    expect(loadPanePreferences('/Vault').active.id).toBe('chat')
  })

  it('ignores leftover chatNoteSplit when the v1 key is missing', () => {
    localStorage.setItem('rhizome:chat-note-split', 'side-by-side')
    expect(loadPanePreferences('/Vault').active.id).toBe('chat')
  })

  it('ignores leftover editor-list plus side-by-side when the v1 key is missing', () => {
    localStorage.setItem('rhizome:vault-config:/Vault', JSON.stringify({ view_mode: 'editor-list' }))
    localStorage.setItem('rhizome:chat-note-split', 'side-by-side')
    expect(loadPanePreferences('/Vault').active.id).toBe('chat')
  })

  it('restores a stored v1 Notes preset', () => {
    localStorage.setItem(panePresetStorageKey('/Vault'), JSON.stringify({
      version: 1,
      active: { id: 'notes', widths: { notes: 280 } },
      savedWidths: { notes: { notes: 280 } },
    }))
    expect(loadPanePreferences('/Vault').active.id).toBe('notes')
    expect(loadPanePreferences('/Vault').active.widths.notes).toBe(280)
  })

  it('restores readNotes from a stored v1 Read preset', () => {
    localStorage.setItem(panePresetStorageKey('/Vault'), JSON.stringify({
      version: 1,
      active: { id: 'read', widths: {}, readNotes: true },
      savedWidths: {},
    }))
    expect(loadPanePreferences('/Vault').active).toMatchObject({ id: 'read', readNotes: true })
  })
})
