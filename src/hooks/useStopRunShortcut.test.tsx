import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { isStopRunShortcut, stopRunAriaKeyShortcuts, stopRunShortcutLabel, useStopRunShortcut } from './useStopRunShortcut'

function key(extra: Partial<KeyboardEvent> = {}) {
  return { key: '.', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }
}

function Harness({ isActive, onStop }: { isActive: boolean; onStop: () => void }) {
  const scopeRef = useRef<HTMLElement>(null)
  useStopRunShortcut(isActive, onStop, scopeRef)
  return (
    <>
      <aside ref={scopeRef} data-testid="panel">
        <div contentEditable data-testid="composer" tabIndex={0} />
        <div data-testid="chat-note-pane-region">
          <div contentEditable data-testid="note-editor" tabIndex={0} />
        </div>
      </aside>
      <input data-testid="outside" />
    </>
  )
}

function pressStop(target: Element, extra: Partial<KeyboardEventInit> = {}) {
  ;(target as HTMLElement).focus()
  const event = new KeyboardEvent('keydown', { key: '.', metaKey: true, ctrlKey: false, bubbles: true, cancelable: true, ...extra })
  const other = new KeyboardEvent('keydown', { key: '.', metaKey: false, ctrlKey: true, bubbles: true, cancelable: true, ...extra })
  target.dispatchEvent(event)
  target.dispatchEvent(other)
  return [event, other]
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
  it('stops the run when focus is in the chat panel', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    const events = pressStop(screen.getByTestId('composer'))
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(events.filter((event) => event.defaultPrevented)).toHaveLength(1)
  })

  it('does nothing when no run is active', () => {
    const onStop = vi.fn()
    render(<Harness isActive={false} onStop={onStop} />)
    const events = pressStop(screen.getByTestId('composer'))
    expect(onStop).not.toHaveBeenCalled()
    expect(events.some((event) => event.defaultPrevented)).toBe(false)
  })

  it('leaves the note editor and the rest of the app alone', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    const inNote = pressStop(screen.getByTestId('note-editor'))
    const outside = pressStop(screen.getByTestId('outside'))
    expect(onStop).not.toHaveBeenCalled()
    expect([...inNote, ...outside].some((event) => event.defaultPrevented)).toBe(false)
  })

  it('ignores a key that an IME is composing', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    pressStop(screen.getByTestId('composer'), { isComposing: true })
    expect(onStop).not.toHaveBeenCalled()
  })

  it('ignores a held key that repeats', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    pressStop(screen.getByTestId('composer'), { repeat: true })
    expect(onStop).not.toHaveBeenCalled()
  })

  it('ignores a key another handler already took', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    const composer = screen.getByTestId('composer')
    composer.addEventListener('keydown', (event) => event.preventDefault())
    pressStop(composer)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('does nothing while a modal is open', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    const modal = document.createElement('div')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    try {
      const events = pressStop(screen.getByTestId('composer'))
      expect(onStop).not.toHaveBeenCalled()
      expect(events.some((event) => event.defaultPrevented)).toBe(false)
    } finally {
      modal.remove()
    }
  })

  it('ignores Escape', () => {
    const onStop = vi.fn()
    render(<Harness isActive onStop={onStop} />)
    pressStop(screen.getByTestId('composer'), { key: 'Escape' })
    expect(onStop).not.toHaveBeenCalled()
  })
})

describe('stopRunAriaKeyShortcuts', () => {
  it('names the key for each platform', () => {
    expect(stopRunAriaKeyShortcuts(true)).toBe('Meta+Period')
    expect(stopRunAriaKeyShortcuts(false)).toBe('Control+Period')
  })
})
