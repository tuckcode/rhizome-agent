import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatNotePane } from './ChatNotePane'

/**
 * The pane is presentational now. It used to fetch the note itself, which
 * meant the open note existed only inside this component — and the agent, one
 * level up, had no idea which note you were reading. The fetch moved to
 * `useChatNoteContent` in Chat, which feeds the pane *and* the agent.
 *
 * Loading is covered by that hook's tests; what is left here is rendering.
 */
describe('ChatNotePane', () => {
  it('shows the note path and closes without leaving chat', () => {
    const onClose = vi.fn()
    render(<ChatNotePane label="wiki/decisions/memory-loop.md" onClose={onClose} />)

    expect(screen.getByTestId('chat-note-pane')).toHaveTextContent('wiki/decisions/memory-loop.md')
    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the body it is given', () => {
    render(
      <ChatNotePane
        label="wiki/decisions/memory-loop.md"
        body={'# Memory loop\n\nPromote is explicit.'}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Memory loop')).toBeInTheDocument()
    expect(screen.getByText(/Promote is explicit/)).toBeInTheDocument()
  })

  it('says so when the note could not be read, rather than spinning forever', () => {
    render(<ChatNotePane label="gone.md" error onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
