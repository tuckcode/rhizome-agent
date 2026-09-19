import { describe, expect, it } from 'vitest'
import {
  bumpViewModeToOpenNotes,
  resolveShellLayout,
  viewModeAfterCollapseNotes,
  viewModeAfterToggleBrowse,
  type ShellLayoutInput,
} from './shellLayout'

function layout(overrides: Partial<ShellLayoutInput> = {}) {
  return resolveShellLayout({
    kind: 'chat-centered',
    viewMode: 'editor-list',
    split: 'stacked',
    noteOpen: false,
    shellWidth: 1600,
    inspectorOpen: false,
    compactVaultPanelOpen: false,
    hideNotesForCanvas: false,
    ...overrides,
  })
}

describe('resolveShellLayout (chat-centered)', () => {
  it('opens Notes with Browse collapsed on the persisted editor-list default', () => {
    const next = layout()
    expect(next.canvas).toBe('chat-centered')
    expect(next.notesOpen).toBe(true)
    expect(next.browseOpen).toBe(false)
    expect(next.showRestoreStrip).toBe(false)
    expect(next.split).toBe('stacked')
  })

  it('hides Notes and shows the restore strip when view mode is editor-only', () => {
    const next = layout({ viewMode: 'editor-only' })
    expect(next.notesOpen).toBe(false)
    expect(next.browseOpen).toBe(false)
    expect(next.showRestoreStrip).toBe(true)
  })

  it('opens Browse when view mode is all', () => {
    const next = layout({ viewMode: 'all' })
    expect(next.notesOpen).toBe(true)
    expect(next.browseOpen).toBe(true)
    expect(next.showRestoreStrip).toBe(false)
  })

  it('does not hide Notes when the window is narrow and the note sits on top', () => {
    const next = layout({ shellWidth: 800, noteOpen: true, split: 'stacked' })
    expect(next.notesOpen).toBe(true)
    expect(next.compactVaultPanel).toBe(false)
    expect(next.compactSessions).toBe(false)
  })

  it('retains a migrated Read list when all columns fit', () => {
    const next = layout({ split: 'side-by-side', noteOpen: true })
    expect(next.notesOpen).toBe(true)
    expect(next.split).toBe('side-by-side')
    expect(next.compactSessions).toBe(false)
  })

  it('does not fold Notes for Beside when Chat has no open note', () => {
    const next = layout({ split: 'side-by-side', noteOpen: false })
    expect(next.compactVaultPanel).toBe(false)
    expect(next.notesOpen).toBe(true)
  })

  it('hides Notes and the restore strip when Research owns the canvas', () => {
    const next = layout({ hideNotesForCanvas: true })
    expect(next.notesOpen).toBe(false)
    expect(next.showRestoreStrip).toBe(false)
  })
})

describe('resolveShellLayout (classic)', () => {
  it('maps editor-list to the note list without a restore strip', () => {
    const next = layout({ kind: 'classic' })
    expect(next.canvas).toBe('classic')
    expect(next.notesOpen).toBe(true)
    expect(next.browseOpen).toBe(false)
    expect(next.classicNoteListVisible).toBe(true)
    expect(next.classicSidebarVisible).toBe(false)
    expect(next.showRestoreStrip).toBe(false)
    expect(next.compactVaultPanel).toBe(false)
  })

  it('maps all to sidebar plus note list', () => {
    const next = layout({ kind: 'classic', viewMode: 'all' })
    expect(next.notesOpen).toBe(true)
    expect(next.browseOpen).toBe(true)
    expect(next.classicSidebarVisible).toBe(true)
    expect(next.classicNoteListVisible).toBe(true)
  })

  it('hides classic columns on the Chat destination', () => {
    const next = layout({ kind: 'classic', viewMode: 'all', chatDestination: true })
    expect(next.notesOpen).toBe(false)
    expect(next.browseOpen).toBe(false)
    expect(next.classicSidebarVisible).toBe(false)
    expect(next.classicNoteListVisible).toBe(false)
    expect(next.showRestoreStrip).toBe(false)
  })
})

describe('shell layout actions (view-mode persistence)', () => {
  it('bumps editor-only to editor-list and leaves Browse open when it already is', () => {
    expect(bumpViewModeToOpenNotes('editor-only')).toBe('editor-list')
    expect(bumpViewModeToOpenNotes('editor-list')).toBe('editor-list')
    expect(bumpViewModeToOpenNotes('all')).toBe('all')
  })

  it('collapses Notes by persisting editor-only', () => {
    expect(viewModeAfterCollapseNotes()).toBe('editor-only')
  })

  it('toggles Browse without closing Notes', () => {
    expect(viewModeAfterToggleBrowse(false)).toBe('all')
    expect(viewModeAfterToggleBrowse(true)).toBe('editor-list')
  })
})
