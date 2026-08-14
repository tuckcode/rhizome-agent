import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MutableRefObject } from 'react'

const startNewChat = vi.fn()

vi.mock('./AiPanel', () => ({
  AiPanel: ({
    newChatRef,
    onOpenNote,
    notePane,
  }: {
    newChatRef?: MutableRefObject<(() => void) | null>
    onOpenNote?: (path: string) => void
    notePane?: React.ReactNode
  }) => {
    if (newChatRef) newChatRef.current = startNewChat
    return (
      <div data-testid="ai-panel-stub">
        <button type="button" onClick={() => onOpenNote?.('/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md')}>
          Open
        </button>
        {notePane}
      </div>
    )
  },
}))

vi.mock('../hooks/usePrimeHostStatus', () => ({
  primeModelLabel: () => 'xai / grok-4.5',
  usePrimeHostStatus: () => ({
    running: true,
    sessionId: '019fe641-61fa-73e9-82ef-91fc90097aab',
    modelName: 'Grok 4.5',
    modelProvider: 'xai',
    modelId: 'grok-4.5',
  }),
}))

import ChatHome from './ChatHome'

describe('ChatHome', () => {
  it('starts a new chat from the Frame A subhead', () => {
    startNewChat.mockClear()
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/dtc/Documents/Laputa"
        vaultPaths={['/Users/dtc/Documents/Laputa']}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(startNewChat).toHaveBeenCalledTimes(1)
  })

  it('opens a note beside chat instead of leaving ChatHome', () => {
    const onOpenNote = vi.fn()
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/dtc/Documents/Laputa"
        vaultPaths={['/Users/dtc/Documents/Laputa']}
        entries={[]}
        onOpenNote={onOpenNote}
        onExit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByTestId('chat-home')).toBeInTheDocument()
    expect(screen.getByTestId('chat-note-pane')).toHaveTextContent('wiki/decisions/memory-loop.md')
    expect(onOpenNote).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(screen.queryByTestId('chat-note-pane')).not.toBeInTheDocument()
  })
})
