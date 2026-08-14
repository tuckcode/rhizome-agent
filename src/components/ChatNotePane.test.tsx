import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatNotePane } from './ChatNotePane'

describe('ChatNotePane', () => {
  it('shows the note path and closes without leaving chat', () => {
    const onClose = vi.fn()
    render(<ChatNotePane label="wiki/decisions/memory-loop.md" onClose={onClose} />)

    expect(screen.getByTestId('chat-note-pane')).toHaveTextContent('wiki/decisions/memory-loop.md')
    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
