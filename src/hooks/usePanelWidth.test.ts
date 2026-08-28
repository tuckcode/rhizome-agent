import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePanelWidth } from './usePanelWidth'

const KEY = 'rhizome:test-panel-width'

beforeEach(() => {
  window.localStorage.clear()
})

describe('usePanelWidth', () => {
  it('starts at the default when nothing has been saved', () => {
    const { result } = renderHook(() => usePanelWidth(KEY, 420, 280, 720))
    expect(result.current.width).toBe(420)
  })

  it('remembers a width across mounts', () => {
    const first = renderHook(() => usePanelWidth(KEY, 420, 280, 720))
    act(() => first.result.current.resizeBy(-60))
    first.unmount()

    const second = renderHook(() => usePanelWidth(KEY, 420, 280, 720))
    expect(second.result.current.width).toBe(480)
  })

  /** A panel dragged to nothing is a panel you cannot get back. */
  it('clamps to the bounds however far the drag goes', () => {
    const { result } = renderHook(() => usePanelWidth(KEY, 420, 280, 720))

    act(() => result.current.resizeBy(5000))
    expect(result.current.width).toBe(280)

    act(() => result.current.resizeBy(-5000))
    expect(result.current.width).toBe(720)
  })

  /** A stored value from a wider window must not survive as an unusable one. */
  it('clamps a stored width that is now out of bounds', () => {
    window.localStorage.setItem(KEY, '9999')
    const { result } = renderHook(() => usePanelWidth(KEY, 420, 280, 720))
    expect(result.current.width).toBe(720)
  })

  it('ignores a stored value that is not a number', () => {
    window.localStorage.setItem(KEY, 'wide please')
    const { result } = renderHook(() => usePanelWidth(KEY, 420, 280, 720))
    expect(result.current.width).toBe(420)
  })
})
