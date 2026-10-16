import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOTES_HOVER_CLOSE_DELAY_MS, RAIL_HOVER_OPEN_DELAY_MS } from '../lib/railChrome'
import { useHoverExpandPanel } from './useHoverExpandPanel'

function renderExpand(overrides: Partial<Parameters<typeof useHoverExpandPanel>[0]> = {}) {
  return renderHook((props: Parameters<typeof useHoverExpandPanel>[0]) => useHoverExpandPanel(props), {
    initialProps: { enabled: true, ...overrides },
  })
}

describe('useHoverExpandPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens after the CommandRail hover-open delay and closes after the notes close delay', () => {
    vi.useFakeTimers()
    const { result } = renderExpand()
    const panel = document.createElement('div')
    result.current.panelRef.current = panel
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: 600, height: 600, left: 800, right: 846, top: 0, width: 46, x: 800, y: 0, toJSON: () => ({}),
    })

    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(RAIL_HOVER_OPEN_DELAY_MS - 1)
    })
    expect(result.current.expanded).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.expanded).toBe(true)
    expect(result.current.overlaying).toBe(true)

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 220, bubbles: true }))
      vi.advanceTimersByTime(NOTES_HOVER_CLOSE_DELAY_MS - 1)
    })
    expect(result.current.expanded).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.expanded).toBe(false)
  })

  it('stays open while focus, a menu, or typing is inside', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderExpand()
    const panel = document.createElement('div')
    const input = document.createElement('input')
    panel.append(input)
    document.body.append(panel)
    result.current.panelRef.current = panel
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: 600, height: 600, left: 800, right: 846, top: 0, width: 46, x: 800, y: 0, toJSON: () => ({}),
    })

    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(RAIL_HOVER_OPEN_DELAY_MS)
    })
    input.focus()
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }))
      vi.advanceTimersByTime(NOTES_HOVER_CLOSE_DELAY_MS + 20)
    })
    expect(result.current.expanded).toBe(true)

    input.blur()
    rerender({ enabled: true, menuOpen: true })
    result.current.panelRef.current = panel
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }))
      vi.advanceTimersByTime(NOTES_HOVER_CLOSE_DELAY_MS + 20)
    })
    expect(result.current.expanded).toBe(true)
    panel.remove()
  })

  it('expands from focus and collapses on Escape back to the mode button', () => {
    const { result } = renderExpand()
    const button = document.createElement('button')
    document.body.append(button)
    result.current.modeButtonRef.current = button

    act(() => {
      result.current.onFocusCapture()
    })
    expect(result.current.expanded).toBe(true)
    expect(result.current.keyboardExpanded).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.expanded).toBe(false)
    expect(document.activeElement).toBe(button)
    button.remove()
  })

  it('does not hover-open while the other side already overlays', () => {
    vi.useFakeTimers()
    const { result } = renderExpand({ peerOverlaying: true })
    act(() => {
      result.current.onMouseEnter()
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.expanded).toBe(false)
  })
})
