import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MutableRefObject } from 'react'

const startNewChat = vi.fn()

vi.mock('../utils/loadChatNoteContent', () => ({
  loadChatNoteContent: vi.fn(async () => '# Memory loop\n\nPromote is explicit.'),
}))

vi.mock('./AiPanel', () => ({
  AiPanel: ({
    newChatRef,
    onOpenNote,
    notePane,
    activeEntry,
    activeNoteContent,
  }: {
    newChatRef?: MutableRefObject<(() => void) | null>
    onOpenNote?: (path: string) => void
    notePane?: React.ReactNode
    activeEntry?: { path: string } | null
    activeNoteContent?: string | null
  }) => {
    if (newChatRef) newChatRef.current = startNewChat
    return (
      <div data-testid="ai-panel-stub">
        <span data-testid="agent-active-note">{activeEntry?.path ?? 'none'}</span>
        <span data-testid="agent-note-body">{activeNoteContent ?? 'none'}</span>
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
import { loadChatNoteContent } from '../utils/loadChatNoteContent'

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

/**
 * The gap this closes: Chat rendered the open note beside the conversation and
 * passed **nothing** to the agent, so "summarise this note" had no "this".
 * `AiPanel` accepted `activeEntry` / `activeNoteContent` all along; ChatHome
 * simply never supplied them.
 */
describe('ChatHome — the agent sees the note you have open', () => {
  beforeEach(() => {
    vi.mocked(loadChatNoteContent).mockClear()
  })

  const entry = {
    path: '/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md',
    filename: 'memory-loop.md',
    title: 'Memory loop',
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    relationships: {},
    outgoingLinks: [],
    properties: {},
    archived: false,
    modifiedAt: 1700000000,
    createdAt: 1700000000,
    fileSize: 10,
    snippet: '',
    wordCount: 0,
    hasH1: false,
    listPropertiesDisplay: [],
  } as never

  function openTheNote() {
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/dtc/Documents/Laputa"
        vaultPaths={['/Users/dtc/Documents/Laputa']}
        entries={[entry]}
        onExit={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  }

  it('hands the agent no note until one is open', () => {
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/dtc/Documents/Laputa"
        vaultPaths={['/Users/dtc/Documents/Laputa']}
        entries={[entry]}
        onExit={vi.fn()}
      />,
    )
    expect(screen.getByTestId('agent-active-note')).toHaveTextContent('none')
  })

  it('hands the agent the open note and its body', async () => {
    openTheNote()

    await waitFor(() => {
      expect(screen.getByTestId('agent-note-body')).toHaveTextContent('Promote is explicit')
    })
    expect(screen.getByTestId('agent-active-note')).toHaveTextContent('memory-loop.md')
  })

  /** One read, two readers — the pane and the agent show the same note. */
  it('reads the note once for both the pane and the agent', async () => {
    openTheNote()

    await waitFor(() => {
      expect(screen.getByTestId('agent-note-body')).toHaveTextContent('Promote is explicit')
    })
    expect(vi.mocked(loadChatNoteContent)).toHaveBeenCalledTimes(1)
  })
})
