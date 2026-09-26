import { describe, expect, it, vi } from 'vitest'
import { parseChatNoteSplit, useChatNoteSplit } from './chatNoteSplit'
import { renderHook, act } from '@testing-library/react'

vi.mock('../lib/productAnalytics', () => ({ trackChatNoteSplitChanged: vi.fn() }))

describe('chat note split compatibility', () => {
  it('parses only the supported legacy split', () => {
    expect(parseChatNoteSplit(null)).toBe('stacked')
    expect(parseChatNoteSplit('vertical')).toBe('stacked')
    expect(parseChatNoteSplit('side-by-side')).toBe('side-by-side')
  })
  it('maps Note on top of Chat to the Chat canvas with an explicit On top choice', () => {
    const setPanePreset = vi.fn()
    const updatePanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'read', widths: { note: 300 } }, setPanePreset, updatePanePreset }))
    expect(result.current.split).toBe('side-by-side')
    act(() => result.current.setSplit('stacked'))
    expect(updatePanePreset).toHaveBeenCalledWith({ id: 'chat', widths: { note: 300 }, stacked: true })
    expect(setPanePreset).not.toHaveBeenCalledWith('notes')
  })

  it('keeps the preset and marks On top when leaving an automatic desk', () => {
    const setPanePreset = vi.fn()
    const updatePanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'notes', widths: {} }, setPanePreset, updatePanePreset }))
    act(() => result.current.setSplit('stacked'))
    expect(updatePanePreset).toHaveBeenCalledWith({ id: 'notes', widths: {}, stacked: true })
  })

  it('clears On top when Beside is picked again', () => {
    const setPanePreset = vi.fn()
    const updatePanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'chat', widths: {}, stacked: true }, setPanePreset, updatePanePreset }))
    act(() => result.current.setSplit('side-by-side'))
    expect(updatePanePreset).toHaveBeenCalledWith({ id: 'chat', widths: {}, stacked: false })
    expect(setPanePreset).not.toHaveBeenCalled()
  })

  it('maps Note beside Chat to Read when no On top choice is set', () => {
    const setPanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'chat', widths: {} }, setPanePreset, updatePanePreset: vi.fn() }))
    act(() => result.current.setSplit('side-by-side'))
    expect(setPanePreset).toHaveBeenCalledWith('read')
  })
})
