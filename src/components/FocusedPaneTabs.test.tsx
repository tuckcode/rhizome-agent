import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FocusedPaneTabs } from './FocusedPaneTabs'

/**
 * Native audit 2026-09-26, "Focused window": in a small window, show one
 * content pane with labeled Chat and Notes tabs instead of compressing both.
 */
describe('FocusedPaneTabs', () => {
  it('labels the two panes Chat and Notes and marks the shown one', () => {
    render(<FocusedPaneTabs value="note" noteTitle="Launch plan" onValueChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'false')
    const notes = screen.getByRole('tab', { name: /Notes/ })
    expect(notes).toHaveAttribute('aria-selected', 'true')
    expect(notes).toHaveTextContent('Launch plan')
  })

  it('switches panes from the tab', () => {
    const onValueChange = vi.fn()
    render(<FocusedPaneTabs value="note" noteTitle="Launch plan" onValueChange={onValueChange} />)
    // Radix Tabs activates on mousedown.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chat' }), { button: 0 })
    expect(onValueChange).toHaveBeenCalledWith('chat')
  })
})
