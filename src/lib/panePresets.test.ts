import { describe, expect, it } from 'vitest'
import { fitPanePreset, presetFromLegacy, presetToLegacy, resizePresetWidth } from './panePresets'

describe('pane presets', () => {
  it.each([
    ['chat', false, false, 'stacked'],
    ['notes', true, false, 'stacked'],
    ['read', false, false, 'side-by-side'],
    ['workbench', true, true, 'stacked'],
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

  it('stacks Read temporarily when the note cannot fit beside Chat', () => {
    expect(fitPanePreset({ id: 'read', widths: {} }, { shellWidth: 639, noteOpen: true })).toMatchObject({ split: 'stacked', chatWidth: 547 })
  })
})
