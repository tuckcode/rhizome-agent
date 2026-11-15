import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { isStopRunShortcut, stopRunShortcutLabel, useStopRunShortcut } from './useStopRunShortcut'

function key(extra: Partial<KeyboardEvent> = {}) {
  return { key: '.', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }
}

function Harness({ isActive, onStop }: { isActive: boolean; onStop: () => void }) {
  useStopRunShortcut(isActive, onStop)
  return null
}

describe('isStopRunShortcut', () => {
  it('is Cmd+Period on Mac and Ctrl+Period elsewhere', () => {
    expect(isStopRunShortcut(key({ metaKey: true }), true)).toBe(true)
    expect(isStopRunShortcut(key({ ctrlKey: true }), true)).toBe(false)
    expect(isStopRunShortcut(key({ ctrlKey: true }), false)).toBe(true)
    expect(isStopRunShortcut(key({ metaKey: true }), false)).toBe(false)
  })

  it('leaves the Notes shortcut alone', () => {
    expect(isStopRunShortcut(key({ metaKey: true, shiftKey: true }), true)).toBe(false)
  })

  it('does not use the key that leaves Chat', () => {
    expect(isStopRunShortcut(key({ key: 'Escape' }), true)).toBe(false)
    expect(isStopRunShortcut(key({ key: 'Escape', metaKey: true }), true)).toBe(false)
  })

  it('shows the shortcut for each platform', () => {
    expect(stopRunShortcutLabel(true)).toBe('⌘.')
    expect(stopRunShortcutLabel(false)).toBe('Ctrl+.')
  })
})

describe('useStopRunShortcut', () => {
  it('stops the run while a run is active', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    fireEvent.keyDown(window, { key: '.', metaKey: true })
    fireEvent.keyDown(window, { key: '.', ctrlKey: true })
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('does nothing when no run is active', () => {
    const onStop = vi.fn()
    render(<Harness isActive={false} onStop={onStop} />)
    fireEvent.keyDown(window, { key: '.', metaKey: true })
    fireEvent.keyDown(window, { key: '.', ctrlKey: true })
    expect(onStop).not.toHaveBeenCalled()
  })

  it('ignores Escape', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onStop).not.toHaveBeenCalled()
  })
})
