import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/loadChatNoteContent', () => ({
  loadChatNoteContent: vi.fn(async () => '# Memory loop\n\nPromote is explicit.'),
}))

import { ChatNotePane } from './ChatNotePane'
import { loadChatNoteContent } from '../utils/loadChatNoteContent'

describe('ChatNotePane', () => {
  beforeEach(() => {
    vi.mocked(loadChatNoteContent).mockClear()
  })

  it('shows the note path and closes without leaving chat', () => {
    const onClose = vi.fn()
    render(<ChatNotePane label="wiki/decisions/memory-loop.md" onClose={onClose} />)

    expect(screen.getByTestId('chat-note-pane')).toHaveTextContent('wiki/decisions/memory-loop.md')
    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the note body after load', async () => {
    render(
      <ChatNotePane
        label="wiki/decisions/memory-loop.md"
        path="wiki/decisions/memory-loop.md"
        vaultPath="/Users/dtc/Documents/Laputa"
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Memory loop')).toBeInTheDocument()
    })
    expect(screen.getByText(/Promote is explicit/)).toBeInTheDocument()
    expect(loadChatNoteContent).toHaveBeenCalledWith(
      'wiki/decisions/memory-loop.md',
      '/Users/dtc/Documents/Laputa',
    )
  })
})
