import { readFileSync } from 'node:fs'
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
    defaultAiTarget,
    composerControls,
  }: {
    newChatRef?: MutableRefObject<(() => void) | null>
    onOpenNote?: (path: string) => void
    notePane?: React.ReactNode
    activeEntry?: { path: string } | null
    activeNoteContent?: string | null
    defaultAiTarget?: { kind: string; label?: string; agent?: string }
    composerControls?: React.ReactNode
  }) => {
    if (newChatRef) newChatRef.current = startNewChat
    return (
      <div data-testid="ai-panel-stub">
        <span data-testid="agent-active-note">{activeEntry?.path ?? 'none'}</span>
        <span data-testid="agent-note-body">{activeNoteContent ?? 'none'}</span>
        <span data-testid="agent-target-kind">{defaultAiTarget?.kind ?? 'none'}</span>
        <span data-testid="composer-controls">{composerControls ? 'yes' : 'no'}</span>
        <button type="button" onClick={() => onOpenNote?.('/Users/jdoe/Documents/Laputa/wiki/decisions/memory-loop.md')}>
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
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(startNewChat).toHaveBeenCalledTimes(1)
  })

  it('keeps Prime chat chrome when settings picked a direct API model', () => {
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiTarget={{
          kind: 'api_model',
          id: 'model:nous-portal/tencent-hy3',
          label: 'nous-portal · tencent-hy3',
          shortLabel: 'tencent-hy3',
          provider: {
            id: 'nous-portal',
            name: 'nous-portal',
            kind: 'open_ai_compatible',
            models: [{ id: 'tencent-hy3', capabilities: { streaming: false, tools: false, vision: false, json_mode: false, reasoning: false } }],
          },
          model: { id: 'tencent-hy3', capabilities: { streaming: false, tools: false, vision: false, json_mode: false, reasoning: false } },
        }}
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    expect(screen.getByTestId('agent-target-kind')).toHaveTextContent('agent')
    expect(screen.getByTestId('composer-controls')).toHaveTextContent('yes')
    expect(screen.getByTestId('prime-session-subhead')).toBeInTheDocument()
  })

  it('opens and closes a note beside chat without leaving ChatHome', () => {
    const onOpenNote = vi.fn()
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[]}
        onOpenNote={onOpenNote}
        onExit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByTestId('chat-home')).toBeInTheDocument()
    expect(screen.getByTestId('chat-note-pane')).toHaveTextContent('wiki/decisions/memory-loop.md')
    expect(onOpenNote).not.toHaveBeenCalled()

    // Moving the mouse must not hide the note — click Close is the only exit
    // (hover-collapse made reading beside Chat brittle on a second display).
    fireEvent.mouseLeave(screen.getByTestId('chat-note-pane-region'))
    expect(screen.getByTestId('chat-note-pane')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(screen.queryByTestId('chat-note-pane')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chat-note-pane-region')).not.toBeInTheDocument()
  })

  it('returns from a note preview to the existing Notes workspace', () => {
    const onShowNotes = vi.fn()
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[]}
        onShowNotes={onShowNotes}
        onExit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to notes' }))

    expect(onShowNotes).toHaveBeenCalledTimes(1)
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
    path: '/Users/jdoe/Documents/Laputa/wiki/decisions/memory-loop.md',
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
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
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
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
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

/**
 * The other direction: right-click a note in the vault and hand it to the
 * agent. App switches to Chat and passes the note in; ChatHome opens it, and
 * the context wiring above does the rest.
 */
describe('ChatHome — a note handed in from the vault', () => {
  const entry = {
    path: '/Users/jdoe/Documents/Laputa/wiki/decisions/memory-loop.md',
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

  function renderWith(requestedNote: { path: string; label: string; requestId: number } | null) {
    return render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[entry]}
        requestedNote={requestedNote}
        onExit={vi.fn()}
      />,
    )
  }

  it('opens the handed-in note and gives it to the agent', async () => {
    renderWith({
      path: '/Users/jdoe/Documents/Laputa/wiki/decisions/memory-loop.md',
      label: 'Memory loop',
      requestId: 1,
    })

    await waitFor(() => {
      expect(screen.getByTestId('agent-note-body')).toHaveTextContent('Promote is explicit')
    })
    expect(screen.getByTestId('agent-active-note')).toHaveTextContent('memory-loop.md')
  })

  /**
   * Asking about the same note twice has to reopen it. Keying on the path
   * alone would make the second ask a no-op once the user had closed the pane.
   */
  it('reopens the same note when it is asked for again', async () => {
    const note = {
      path: '/Users/jdoe/Documents/Laputa/wiki/decisions/memory-loop.md',
      label: 'Memory loop',
    }
    const { rerender } = renderWith({ ...note, requestId: 1 })
    await waitFor(() => {
      expect(screen.getByTestId('agent-note-body')).toHaveTextContent('Promote is explicit')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close note' }))
    expect(screen.queryByTestId('chat-note-pane')).not.toBeInTheDocument()

    rerender(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath="/Users/jdoe/Documents/Laputa"
        vaultPaths={['/Users/jdoe/Documents/Laputa']}
        entries={[entry]}
        requestedNote={{ ...note, requestId: 2 }}
        onExit={vi.fn()}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('agent-note-body')).toHaveTextContent('Promote is explicit')
    })
    expect(screen.getByTestId('chat-note-pane')).toBeInTheDocument()
  })
})

describe('ChatHome composer wiring', () => {
  const chatHomeSource = readFileSync(`${process.cwd()}/src/components/ChatHome.tsx`, 'utf8')

  it('puts the Agents idle/working pill on the composer next to thinking', () => {
    expect(chatHomeSource).toContain('activity={')
    expect(chatHomeSource).toContain('<AgentsPill')
    expect(chatHomeSource).toContain('jobs={rhizomeJobs.activeJobs}')
  })

  it('keeps the skills pill as rhizome-vault, not a vault switcher', () => {
    expect(chatHomeSource).toContain('composerSkillsLabel="rhizome-vault"')
    expect(chatHomeSource).not.toContain('composer-vault-pill')
  })

  it('forwards a width-folded Sessions column into the panel', () => {
    expect(chatHomeSource).toContain('sessionsAutoCollapsed={sessionsAutoCollapsed}')
  })

  it('wires Escape leave-Chat to onExit, not Stop', () => {
    expect(chatHomeSource).toContain('onClose={onExit}')
    expect(chatHomeSource).not.toMatch(/onClose=\{[^}]*stop/i)
  })

  it('shows Chat preflight on the composer, not a vault gate', () => {
    expect(chatHomeSource).toContain('<ChatPreflightBanner')
    expect(chatHomeSource).toContain('vaultPath={vaultPath}')
    expect(chatHomeSource).toContain('provider={primeHost?.modelProvider ?? null}')
  })

  it('keeps a Settings API default on the Prime harness', () => {
    expect(chatHomeSource).toContain("if (defaultAiTarget?.kind === 'api_model')")
    expect(chatHomeSource).toContain("target.kind === 'agent' && target.agent === 'prime'")
  })

  it('polls Prime host status from whatever vaultPath Chat has, including empty', () => {
    expect(chatHomeSource).toContain('usePrimeHostStatus(isPrimeTarget, vaultPath)')
    expect(chatHomeSource).not.toMatch(/usePrimeHostStatus\([^)]*vaultPath\s*&&/)
    expect(chatHomeSource).not.toMatch(/usePrimeHostStatus\([^)]*vaultPath\s*\?/)
  })

  it('does not bail out of Chat when vaultPath is empty', () => {
    expect(chatHomeSource).not.toMatch(/if\s*\(\s*!vaultPath/)
    expect(chatHomeSource).not.toMatch(/if\s*\(\s*!vaultPath\.trim/)
  })

  it('still mounts the Prime composer deck without a vault gate', () => {
    expect(chatHomeSource).toContain('<ChatComposerDeck')
    expect(chatHomeSource).not.toMatch(/vaultPath\s*&&\s*\(?\s*<ChatComposerDeck/)
    expect(chatHomeSource).not.toMatch(/vaultPath\s*\?\s*\(?\s*<ChatComposerDeck/)
  })
})

describe('ChatHome without a vault', () => {
  it('still mounts Chat when no vault is attached', () => {
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath=""
        vaultPaths={[]}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    expect(screen.getByTestId('ai-panel-stub')).toBeInTheDocument()
  })

  it('still offers New chat when no vault is attached', () => {
    startNewChat.mockClear()
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath=""
        vaultPaths={[]}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(startNewChat).toHaveBeenCalledTimes(1)
  })

  it('still mounts Prime composer chrome when no vault is attached', () => {
    render(
      <ChatHome
        locale="en"
        defaultAiAgent="prime"
        defaultAiAgentReadiness="ready"
        defaultAiAgentReady
        vaultPath=""
        vaultPaths={[]}
        entries={[]}
        onExit={vi.fn()}
      />,
    )

    expect(screen.getByTestId('composer-controls')).toHaveTextContent('yes')
  })
})
