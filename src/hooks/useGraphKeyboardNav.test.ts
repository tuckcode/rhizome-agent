import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, renderHook } from '@testing-library/react'
import { useGraphKeyboardNav } from './useGraphKeyboardNav'

function mountHost() {
  const host = document.createElement('div')
  host.tabIndex = 0
  document.body.appendChild(host)
  host.focus()
  return host
}

function makeOptions(overrides: Partial<Parameters<typeof useGraphKeyboardNav>[0]> = {}) {
  const host = overrides.getContainer ? null : mountHost()
  return {
    enabled: true,
    adjacency: new Map([
      ['a', new Set(['b', 'c'])],
      ['b', new Set(['a'])],
      ['c', new Set(['a'])],
    ]),
    nodes: [
      { id: 'a', linkCount: 2, backlinkCount: 0 },
      { id: 'b', linkCount: 1, backlinkCount: 0 },
      { id: 'c', linkCount: 1, backlinkCount: 0 },
    ],
    focusedId: 'a' as string | null,
    getPositions: () => new Map(),
    getContainer: () => host,
    onFocus: vi.fn(),
    onOpen: vi.fn(),
    onEscape: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useGraphKeyboardNav', () => {
  it('moves focus along adjacency on arrow keys (sorted fallback)', () => {
    const options = makeOptions()
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(options.onFocus).toHaveBeenCalledWith('b')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(options.onFocus).toHaveBeenCalledWith('c')
  })

  it('focuses a start node when nothing is selected yet', () => {
    const options = makeOptions({ focusedId: null })
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(options.onFocus).toHaveBeenCalledWith('a')
    expect(options.onOpen).not.toHaveBeenCalled()
  })

  it('opens the focused node on Enter and escapes on Escape', () => {
    const options = makeOptions()
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(options.onOpen).toHaveBeenCalledWith('a')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(options.onEscape).toHaveBeenCalledOnce()
  })

  it('does nothing when disabled', () => {
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
  })

  it('does not steal Enter from a focused button in another pane', () => {
    const options = makeOptions()
    renderHook(() => useGraphKeyboardNav(options))

    const button = document.createElement('button')
    button.textContent = 'Open note'
    document.body.appendChild(button)
    button.focus()
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: 'ArrowRight' })
    expect(options.onOpen).not.toHaveBeenCalled()
    expect(options.onFocus).not.toHaveBeenCalled()
  })

  it('still handles Escape when a control inside the graph is focused', () => {
    const host = mountHost()
    const button = document.createElement('button')
    button.textContent = 'Close graph'
    host.appendChild(button)
    button.focus()
    const options = makeOptions({ getContainer: () => host })
    renderHook(() => useGraphKeyboardNav(options))

    fireEvent.keyDown(button, { key: 'Escape' })
    expect(options.onEscape).toHaveBeenCalledOnce()
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(options.onOpen).not.toHaveBeenCalled()
  })

  it('detaches the listener on unmount', () => {
    const options = makeOptions()
    const { unmount } = renderHook(() => useGraphKeyboardNav(options))
    unmount()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(options.onFocus).not.toHaveBeenCalled()
  })
})
