import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NoteIcon } from './NoteIcon'
import { FOCUS_NOTE_ICON_PROPERTY_EVENT } from './noteIconPropertyEvents'

describe('NoteIcon', () => {
  it('shows add button when no icon is set', () => {
    render(<NoteIcon icon={null} />)
    expect(screen.getByTestId('note-icon-add')).toBeInTheDocument()
    expect(screen.queryByTestId('note-icon-display')).not.toBeInTheDocument()
  })

  it('displays the emoji when icon is set', () => {
    render(<NoteIcon icon="🎯" />)
    expect(screen.getByTestId('note-icon-display')).toHaveTextContent('🎯')
    expect(screen.queryByTestId('note-icon-add')).not.toBeInTheDocument()
  })

  it('displays Phosphor icons when icon is set', () => {
    render(<NoteIcon icon="rocket" />)
    expect(screen.getByTestId('note-icon-display').querySelector('svg')).toBeInTheDocument()
  })

  it('displays image icons when icon is set to a url', () => {
    render(<NoteIcon icon="https://example.com/favicon.png" />)
    expect(screen.getByTestId('note-icon-display').querySelector('img')).toBeInTheDocument()
  })

  it('focuses the icon property when add button is clicked', () => {
    const handler = vi.fn()
    window.addEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handler)

    render(<NoteIcon icon={null} />)
    fireEvent.click(screen.getByTestId('note-icon-add'))

    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handler)
  })

  it('focuses the icon property when existing icon is clicked', () => {
    const handler = vi.fn()
    window.addEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handler)

    render(<NoteIcon icon="🔥" />)
    fireEvent.click(screen.getByTestId('note-icon-display'))

    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handler)
  })

  it('hides add button when not editable', () => {
    render(<NoteIcon icon={null} editable={false} />)
    expect(screen.queryByTestId('note-icon-add')).not.toBeInTheDocument()
  })

  it('disables icon click when not editable', () => {
    render(<NoteIcon icon="🎯" editable={false} />)
    const display = screen.getByTestId('note-icon-display')
    expect(display).toBeDisabled()
  })

  it('maps the legacy picker event to the icon property focus event', () => {
    const handler = vi.fn()
    window.addEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handler)

    render(<NoteIcon icon={null} />)
    act(() => { window.dispatchEvent(new CustomEvent('laputa:open-icon-picker')) })

    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener(FOCUS_NOTE_ICON_PROPERTY_EVENT, handler)
  })
})
