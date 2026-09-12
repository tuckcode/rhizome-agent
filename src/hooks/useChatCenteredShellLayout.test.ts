import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChatCenteredShellLayout } from './useChatCenteredShellLayout'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import type { ViewMode } from './useViewMode'

vi.mock('../lib/productAnalytics', () => ({
  trackChatNoteSplitChanged: vi.fn(),
}))

function renderShell(viewMode: ViewMode, overrides: Partial<Parameters<typeof useChatCenteredShellLayout>[0]> = {}) {
  const setViewMode = vi.fn()
  const hook = renderHook(
    (props: { viewMode: ViewMode }) => useChatCenteredShellLayout({
      kind: 'chat-centered',
      viewMode: props.viewMode,
      setViewMode,
      noteOpen: false,
      inspectorOpen: false,
      hideNotesForCanvas: false,
      ...overrides,
    }),
    { initialProps: { viewMode } },
  )
  return { ...hook, setViewMode }
}

describe('useChatCenteredShellLayout', () => {
  it('reports notesOpen from the persisted view mode, not a derived flag soup', () => {
    const { result } = renderShell('editor-list')
    expect(result.current.notesOpen).toBe(true)
    expect(result.current.browseOpen).toBe(false)
    expect(result.current.showRestoreStrip).toBe(false)
  })

  it('ensureNotesOpen bumps editor-only without closing an already-open column', () => {
    const { result, setViewMode, rerender } = renderShell('editor-only')
    expect(result.current.notesOpen).toBe(false)
    expect(result.current.showRestoreStrip).toBe(true)

    act(() => {
      result.current.ensureNotesOpen()
    })
    expect(setViewMode).toHaveBeenCalledWith('editor-list')

    rerender({ viewMode: 'editor-list' })
    expect(result.current.notesOpen).toBe(true)

    setViewMode.mockClear()
    act(() => {
      result.current.ensureNotesOpen()
    })
    expect(setViewMode).not.toHaveBeenCalled()
    expect(result.current.notesOpen).toBe(true)
  })

  it('collapseNotes persists editor-only and shows the restore strip', () => {
    const { result, setViewMode, rerender } = renderShell('editor-list')
    act(() => {
      result.current.collapseNotes()
    })
    expect(setViewMode).toHaveBeenCalledWith('editor-only')
    rerender({ viewMode: 'editor-only' })
    expect(result.current.notesOpen).toBe(false)
    expect(result.current.showRestoreStrip).toBe(true)
  })

  it('toggleBrowse switches all and editor-list without hiding Notes', () => {
    const { result, setViewMode } = renderShell('editor-list')
    act(() => {
      result.current.toggleBrowse()
    })
    expect(setViewMode).toHaveBeenCalledWith('all')
  })

  it('Beside with an open note folds Notes until ensureNotesOpen', () => {
    window.localStorage.setItem(APP_STORAGE_KEYS.chatNoteSplit, 'stacked')
    const setViewMode = vi.fn()
    const { result, rerender } = renderHook(
      (props: { noteOpen: boolean }) => useChatCenteredShellLayout({
        kind: 'chat-centered',
        viewMode: 'editor-list',
        setViewMode,
        noteOpen: props.noteOpen,
        inspectorOpen: false,
        hideNotesForCanvas: false,
      }),
      { initialProps: { noteOpen: true } },
    )

    act(() => {
      result.current.setSplit('side-by-side')
    })
    rerender({ noteOpen: true })
    expect(result.current.notesOpen).toBe(false)
    expect(result.current.showRestoreStrip).toBe(true)

    act(() => {
      result.current.ensureNotesOpen()
    })
    expect(result.current.notesOpen).toBe(true)
    window.localStorage.removeItem(APP_STORAGE_KEYS.chatNoteSplit)
  })
})
