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
  it('reads and changes the preset without independent state', () => {
    const setPanePreset = vi.fn()
    const { result } = renderHook(() => useChatNoteSplit({ panePreset: { id: 'read', widths: {} }, setPanePreset }))
    expect(result.current.split).toBe('side-by-side')
    act(() => result.current.setSplit('stacked'))
    expect(setPanePreset).toHaveBeenCalledWith('notes')
  })
})
