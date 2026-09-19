import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChatCenteredShellLayout } from './useChatCenteredShellLayout'
import { useViewMode } from './useViewMode'
import { resetVaultConfigStore } from '../utils/vaultConfigStore'

vi.mock('../lib/telemetry', () => ({ trackEvent: vi.fn() }))
vi.mock('../lib/productAnalytics', () => ({ trackChatNoteSplitChanged: vi.fn() }))

function renderShell() {
  return renderHook(() => {
    const controls = useViewMode()
    return { controls, layout: useChatCenteredShellLayout({
      ...controls, kind: 'chat-centered', noteOpen: true, inspectorOpen: false,
      railPinned: false, hideNotesForCanvas: false,
    }) }
  })
}

beforeEach(() => { localStorage.clear(); resetVaultConfigStore() })

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

  it('maps the split control to Read and Notes', () => {
    const { result } = renderShell()
    act(() => result.current.layout.setSplit('side-by-side'))
    expect(result.current.controls.panePreset.id).toBe('read')
    expect(result.current.layout.split).toBe('side-by-side')
    expect(result.current.layout.notesOpen).toBe(false)
    act(() => result.current.layout.setSplit('stacked'))
    expect(result.current.controls.panePreset.id).toBe('notes')
    expect(result.current.layout.notesOpen).toBe(true)
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
