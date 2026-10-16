import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { notesPanelModeStorageKey } from '../lib/notesPanelMode'

const { trackNotesPanelModeChanged } = vi.hoisted(() => ({
  trackNotesPanelModeChanged: vi.fn(),
}))

vi.mock('../lib/productAnalytics', () => ({
  trackNotesPanelModeChanged,
}))

import { useNotesPanelMode } from './useNotesPanelMode'

describe('useNotesPanelMode', () => {
  afterEach(() => {
    localStorage.clear()
    trackNotesPanelModeChanged.mockClear()
  })

  it('reads and writes the mode for this window only', () => {
    localStorage.setItem(notesPanelModeStorageKey('main'), 'auto')
    localStorage.setItem(notesPanelModeStorageKey('note-9'), 'rail')

    const main = renderHook(() => useNotesPanelMode('main'))
    const other = renderHook(() => useNotesPanelMode('note-9'))

    expect(main.result.current.mode).toBe('auto')
    expect(other.result.current.mode).toBe('rail')

    act(() => {
      main.result.current.setMode('open')
    })

    expect(main.result.current.mode).toBe('open')
    expect(other.result.current.mode).toBe('rail')
    expect(localStorage.getItem(notesPanelModeStorageKey('main'))).toBe('open')
    expect(localStorage.getItem(notesPanelModeStorageKey('note-9'))).toBe('rail')
    expect(trackNotesPanelModeChanged).toHaveBeenCalledWith('open')
  })

  it('cycles from the panel shortcut', () => {
    const { result } = renderHook(() => useNotesPanelMode('main'))
    expect(result.current.mode).toBe('open')

    const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: '.',
        metaKey: mac,
        ctrlKey: !mac,
        shiftKey: true,
        bubbles: true,
      }))
    })

    expect(result.current.mode).toBe('auto')
    expect(localStorage.getItem(notesPanelModeStorageKey('main'))).toBe('auto')
  })

  it('fires analytics once per cycle under StrictMode', () => {
    const { result } = renderHook(() => useNotesPanelMode('main'), { wrapper: StrictMode })
    act(() => {
      result.current.cycleMode()
    })
    expect(result.current.mode).toBe('auto')
    expect(trackNotesPanelModeChanged).toHaveBeenCalledTimes(1)
    expect(trackNotesPanelModeChanged).toHaveBeenCalledWith('auto')
  })

  it('does not use the shared command-rail expanded key', () => {
    const { result } = renderHook(() => useNotesPanelMode('main'))
    act(() => result.current.setMode('rail'))
    expect(localStorage.getItem(APP_STORAGE_KEYS.commandRailExpanded)).toBeNull()
    expect(localStorage.getItem(notesPanelModeStorageKey('main'))).toBe('rail')
  })
})
