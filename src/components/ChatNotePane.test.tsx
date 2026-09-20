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
  it('shows the note path and can hide the pane without leaving chat', () => {
    const onClose = vi.fn()
    render(<ChatNotePane label="wiki/decisions/memory-loop.md" onClose={onClose} />)

    expect(screen.getByText('Note preview')).toBeInTheDocument()
    expect(screen.getByTestId('chat-note-pane')).toHaveTextContent('wiki/decisions/memory-loop.md')
    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * D5. The header label truncates. Close and Back already have titles.
   * The note name did not, so a long path vanished on hover.
   */
  it('exposes the full header label as a pointer tooltip', () => {
    const label = 'wiki/decisions/a-very-long-note-name-that-will-truncate.md'
    render(<ChatNotePane label={label} onClose={vi.fn()} />)

    expect(screen.getByText(label)).toHaveAttribute('title', label)
  })

  it('returns to the Notes workspace', () => {
    const onBackToNotes = vi.fn()
    render(
      <ChatNotePane
        label="wiki/decisions/memory-loop.md"
        onBackToNotes={onBackToNotes}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back to notes' }))
    expect(onBackToNotes).toHaveBeenCalledTimes(1)
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

describe('ChatNotePane — resizing', () => {
  it('has no handle when Chat does not offer one', () => {
    render(<ChatNotePane label="a.md" onClose={vi.fn()} />)
    expect(screen.queryByTestId('chat-note-pane-resize')).not.toBeInTheDocument()
  })

  /**
   * Dragging the divider left widens the note. The pane reports the raw
   * delta and `usePanelWidth` owns the sign and the bounds, so the two can be
   * reasoned about separately.
   */
  it('reports the drag distance from its left edge', () => {
    const onResize = vi.fn()
    render(<ChatNotePane label="a.md" width={448} onResize={onResize} onClose={vi.fn()} />)

    const handle = screen.getByTestId('chat-note-pane-resize')
    fireEvent.mouseDown(handle, { clientX: 600, clientY: 300 })
    fireEvent.mouseMove(window, { clientX: 560, clientY: 300 })
    fireEvent.mouseUp(window)

    expect(onResize).toHaveBeenCalledWith(-40)
  })

  it('renders at the width it is given', () => {
    render(<ChatNotePane label="a.md" width={512} onResize={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByTestId('chat-note-pane')).toHaveStyle({ width: '512px' })
  })
})
