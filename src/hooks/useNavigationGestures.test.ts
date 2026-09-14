import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNavigationGestures } from './useNavigationGestures'

function fireMouse(type: string, button: number, target: EventTarget = window) {
  const event = new MouseEvent(type, { button, bubbles: true, cancelable: true })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

describe('useNavigationGestures', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('goes back on mouse button 3 along the note trail', () => {
    const onGoBack = vi.fn()
    renderHook(() => useNavigationGestures({ onGoBack, onGoForward: vi.fn() }))
    fireMouse('mousedown', 3)
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })

  it('goes forward on mouse button 4', () => {
    const onGoForward = vi.fn()
    renderHook(() => useNavigationGestures({ onGoBack: vi.fn(), onGoForward }))
    fireMouse('mousedown', 4)
    expect(onGoForward).toHaveBeenCalledTimes(1)
  })

  it('still goes back when the focused note stops bubbling mouseup', () => {
    const onGoBack = vi.fn()
    renderHook(() => useNavigationGestures({ onGoBack, onGoForward: vi.fn() }))
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    document.body.append(editor)
    editor.addEventListener('mouseup', (event) => event.stopPropagation())
    fireMouse('mousedown', 3, editor)
    fireMouse('mouseup', 3, editor)
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })

  it('does not walk two notes when both mousedown and mouseup fire', () => {
    const onGoBack = vi.fn()
    renderHook(() => useNavigationGestures({ onGoBack, onGoForward: vi.fn() }))
    fireMouse('mousedown', 3)
    fireMouse('mouseup', 3)
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })

  it('ignores left and right clicks', () => {
    const onGoBack = vi.fn()
    const onGoForward = vi.fn()
    renderHook(() => useNavigationGestures({ onGoBack, onGoForward }))
    fireMouse('mousedown', 0)
    fireMouse('mousedown', 2)
    expect(onGoBack).not.toHaveBeenCalled()
    expect(onGoForward).not.toHaveBeenCalled()
  })

  it('walks the note trail only — no Prime session stack this window', () => {
    const source = readFileSync(`${process.cwd()}/src/hooks/useNavigationGestures.ts`, 'utf8')
    expect(source).toContain('walk the note trail')
    expect(source).not.toMatch(/switch_prime_session|sessionPath|primeSession/)
  })
})
