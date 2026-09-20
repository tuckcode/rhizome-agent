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
  it('maps Note on top of Chat to the Chat canvas, not the Notes column', () => {
    const setPanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'read', widths: {} }, setPanePreset }))
    expect(result.current.split).toBe('side-by-side')
    act(() => result.current.setSplit('stacked'))
    expect(setPanePreset).toHaveBeenCalledWith('chat')
    expect(setPanePreset).not.toHaveBeenCalledWith('notes')
  })

  it('maps Note beside Chat to Read', () => {
    const setPanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'chat', widths: {} }, setPanePreset }))
    expect(result.current.split).toBe('stacked')
    act(() => result.current.setSplit('side-by-side'))
    expect(setPanePreset).toHaveBeenCalledWith('read')
  })
})
