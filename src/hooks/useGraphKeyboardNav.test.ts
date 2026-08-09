import { describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook } from '@testing-library/react'
import { useGraphKeyboardNav } from './useGraphKeyboardNav'

function makeOptions(overrides: Partial<Parameters<typeof useGraphKeyboardNav>[0]> = {}) {
  return {
    enabled: true,
    adjacency: new Map([
      ['a', new Set(['b', 'c'])],
      ['b', new Set(['a'])],
      ['c', new Set(['a'])],
    ]),
    focusedId: 'a' as string | null,
    getPositions: () => new Map(),
    onFocus: vi.fn(),
    onOpen: vi.fn(),
    onEscape: vi.fn(),
    ...overrides,
  }
}

describe('useGraphKeyboardNav', () => {
  it('moves focus along adjacency on arrow keys (sorted fallback)', () => {
    const options = makeOptions()
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(options.onFocus).toHaveBeenCalledWith('b')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(options.onFocus).toHaveBeenCalledWith('c')
  })

  it('opens the focused node on Enter and escapes on Escape', () => {
    const options = makeOptions()
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(options.onOpen).toHaveBeenCalledWith('a')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(options.onEscape).toHaveBeenCalledOnce()
  })

  it('does nothing when disabled or without a focused node (except Escape needs enabled)', () => {
    const options = makeOptions({ enabled: false })
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(options.onFocus).not.toHaveBeenCalled()
    expect(options.onEscape).not.toHaveBeenCalled()
  })

  it('ignores keystrokes typed into editable targets', () => {
    const options = makeOptions()
    renderHook(() => useGraphKeyboardNav(options))

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect(options.onFocus).not.toHaveBeenCalled()
    input.remove()
  })

  it('detaches the listener on unmount', () => {
    const options = makeOptions()
    const { unmount } = renderHook(() => useGraphKeyboardNav(options))
    unmount()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(options.onFocus).not.toHaveBeenCalled()
  })
})
