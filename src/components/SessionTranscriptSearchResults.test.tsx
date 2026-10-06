import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionTranscriptSearchResults } from './SessionTranscriptSearchResults'
import type { SessionTranscriptHit } from '../lib/sessionTranscriptSearch'

const hit: SessionTranscriptHit = {
  sessionId: 'daemon',
  sessionPath: '/sessions/daemon.jsonl',
  sessionTitle: 'Daemon notes',
  messageIndex: 4,
  role: 'assistant',
  excerpt: 'The daemon transport uses a named socket.',
}

describe('SessionTranscriptSearchResults', () => {
  it('renders a Sessions group and hands the hit to the opener', () => {
    const onSelect = vi.fn()
    render(<SessionTranscriptSearchResults hits={[hit]} onSelect={onSelect} />)

    expect(screen.getByRole('region', { name: 'Sessions' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /Daemon notes/ }))

    expect(onSelect).toHaveBeenCalledWith(hit)
    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('The daemon transport uses a named socket.')).toBeInTheDocument()
  })

  it('marks the keyboard-selected hit', () => {
    render(<SessionTranscriptSearchResults hits={[hit]} selectedIndex={0} />)

    expect(screen.getByRole('option', { name: /Daemon notes/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders nothing when there are no hits', () => {
    const { container } = render(<SessionTranscriptSearchResults hits={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
