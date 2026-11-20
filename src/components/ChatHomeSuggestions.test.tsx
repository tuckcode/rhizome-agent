import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatHomeSuggestions } from './ChatHomeSuggestions'

const trackEvent = vi.fn()
vi.mock('../lib/telemetry', () => ({ trackEvent: (name: string) => trackEvent(name) }))

describe('ChatHomeSuggestions', () => {
  const onPrefill = vi.fn()

  beforeEach(() => {
    onPrefill.mockClear()
    trackEvent.mockClear()
    window.addEventListener('rhizome:ai-composer-prefill', onPrefill)
  })

  afterEach(() => {
    window.removeEventListener('rhizome:ai-composer-prefill', onPrefill)
  })

  function prefilled(): string[] {
    return onPrefill.mock.calls.map((call) => (call[0] as CustomEvent<{ text: string }>).detail.text)
  }

  it('fills the composer from a starter card and does not use a primary fill', () => {
    render(<ChatHomeSuggestions />)

    expect(screen.getAllByTestId('chat-empty-starter').every((button) => (
      button.getAttribute('class')?.includes('border')
      && !button.getAttribute('class')?.includes('bg-primary')
    ))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Explain this repo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Find and fix a bug' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write tests for a file' }))
    expect(prefilled()).toEqual(['Explain this repo', 'Find and fix a bug', 'Write tests for a file'])
  })

  it('says what each starter does', () => {
    render(<ChatHomeSuggestions />)
    // The pill shows the label. The detail shows on hover.
    expect(screen.getByRole('button', { name: 'Find and fix a bug' })).toHaveAttribute('title', 'Reproduce it, then repair it')
  })

  it('offers the notes that changed last as context for a new chat', () => {
    const onOpenNote = vi.fn()
    render(
      <ChatHomeSuggestions
        onOpenNote={onOpenNote}
        recentNotes={[
          { path: '/vault/weekly-plan.md', title: 'Weekly Plan 4', modifiedAt: Math.floor(Date.now() / 1000) - 7200 },
          { path: '/vault/review.md', title: 'Daily Review 3', modifiedAt: Math.floor(Date.now() / 1000) - 90000 },
        ]}
      />,
    )

    const section = screen.getByTestId('chat-home-recent-notes')
    expect(section).toHaveTextContent('Continue from a note')
    expect(section).toHaveTextContent('2h ago')

    fireEvent.click(screen.getByRole('button', { name: 'Ask about Weekly Plan 4' }))
    expect(prefilled()).toEqual(['[[Weekly Plan 4]] '])
    expect(trackEvent).toHaveBeenCalledWith('chat_home_note_picked')

    fireEvent.click(screen.getByRole('button', { name: 'Open Daily Review 3' }))
    expect(onOpenNote).toHaveBeenCalledWith('/vault/review.md')
  })

  it('shows no note section when the vault has no recent note', () => {
    render(<ChatHomeSuggestions recentNotes={[]} />)
    expect(screen.queryByTestId('chat-home-recent-notes')).toBeNull()
    expect(screen.getAllByTestId('chat-empty-starter')).toHaveLength(3)
  })
})
