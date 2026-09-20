import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChatCenteredShellLayout } from './useChatCenteredShellLayout'
import { useViewMode } from './useViewMode'
import { resetVaultConfigStore } from '../utils/vaultConfigStore'

vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))
vi.mock('../lib/productAnalytics', () => ({ trackChatNoteSplitChanged: vi.fn() }))

let mockedShellWidth: number | null = null

vi.mock('./useShellCompactLayout', () => ({
  useShellCompactLayout: () => ({
    shellRef: { current: null },
    get width() { return mockedShellWidth },
    collapseSessions: false,
    collapseVaultPanel: false,
  }),
}))

function renderShell() {
  return renderHook(() => {
    const controls = useViewMode()
    return { controls, layout: useChatCenteredShellLayout({
      ...controls, kind: 'chat-centered', noteOpen: true, inspectorOpen: false,
      railPinned: false, hideNotesForCanvas: false,
    }) }
  })
}

beforeEach(() => {
  mockedShellWidth = null
  localStorage.clear()
  resetVaultConfigStore()
})

describe('preset shell controls', () => {
  it('opens Notes, opens Browse, and collapses to Chat through one preset', () => {
    const { result } = renderShell()
    expect(result.current.layout.showRestoreStrip).toBe(true)
    act(() => result.current.layout.ensureNotesOpen())
    expect(result.current.controls.panePreset.id).toBe('notes')
    expect(result.current.layout.notesOpen).toBe(true)
    act(() => result.current.layout.toggleBrowse())
    expect(result.current.controls.panePreset.id).toBe('workbench')
    expect(result.current.layout.browseOpen).toBe(true)
    act(() => result.current.layout.collapseNotes())
    expect(result.current.controls.panePreset.id).toBe('chat')
    expect(result.current.layout.showRestoreStrip).toBe(true)
  })

  it('maps the split control to Read and Chat', () => {
    const { result } = renderShell()
    act(() => result.current.layout.setSplit('side-by-side'))
    expect(result.current.controls.panePreset.id).toBe('read')
    expect(result.current.layout.split).toBe('side-by-side')
    expect(result.current.layout.notesOpen).toBe(false)
    act(() => result.current.layout.setSplit('stacked'))
    expect(result.current.controls.panePreset.id).toBe('chat')
    expect(result.current.layout.notesOpen).toBe(false)
  })

  it('keeps Workbench when ensureNotesOpen runs', () => {
    const { result } = renderShell()
    act(() => result.current.controls.setPanePreset('workbench'))
    expect(result.current.controls.panePreset.id).toBe('workbench')
    act(() => result.current.layout.ensureNotesOpen())
    expect(result.current.controls.panePreset.id).toBe('workbench')
    expect(result.current.layout.browseOpen).toBe(true)
  })
})

describe('preset column drag', () => {
  it('applies later deltas to the last committed note width', () => {
    mockedShellWidth = 1400
    const { result } = renderShell()
    act(() => result.current.layout.setSplit('side-by-side'))
    const captured = result.current.layout.resizeColumn
    act(() => captured('note', 10))
    act(() => captured('note', 10))
    expect(result.current.controls.panePreset.widths.note).toBe(380)
  })

  it('does not ratchet a tight beside note when leftovers could move to Notes', () => {
    mockedShellWidth = 1000
    const { result } = renderShell()
    act(() => result.current.controls.updatePanePreset({ id: 'read', widths: { note: 360 }, readNotes: true }))
    for (let i = 0; i < 16; i += 1) {
      act(() => result.current.layout.resizeColumn('note', i % 2 === 0 ? 10 : -10))
    }
    expect(result.current.controls.panePreset.widths.note).toBeGreaterThan(300)
    expect(result.current.layout.widths.note).toBeGreaterThan(300)
  })
})
