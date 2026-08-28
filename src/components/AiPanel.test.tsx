import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render as rtlRender, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { AiPanel, AiPanelView } from './AiPanel'
import { UNSUPPORTED_INLINE_PASTE_MESSAGE } from './InlineWikilinkInput'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AiPanelController } from './useAiPanelController'
import type { VaultEntry } from '../types'
import { queueAiPrompt } from '../utils/aiPromptBridge'
import type { NoteReference } from '../utils/ai-context'
import { bindVaultConfigStore, getVaultConfig, resetVaultConfigStore } from '../utils/vaultConfigStore'
import { APP_STORAGE_KEYS } from '../constants/appStorage'

const { sendToRunningTurnMock, trackEventMock } = vi.hoisted(() => ({
  sendToRunningTurnMock: vi.fn(),
  trackEventMock: vi.fn(),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: trackEventMock,
}))

vi.mock('../lib/primeTurnMessaging', () => ({
  sendToRunningTurn: sendToRunningTurnMock,
}))

// Mock the hooks and utils to isolate component tests
let mockMessages: ReturnType<typeof import('../hooks/useCliAiAgent').useCliAiAgent>['messages'] = []
let mockStatus: ReturnType<typeof import('../hooks/useCliAiAgent').useCliAiAgent>['status'] = 'idle'
const mockSendMessage = vi.fn()
const mockStopMessage = vi.fn()
const mockClearConversation = vi.fn()
const mockAddLocalMarker = vi.fn()
const mockUseCliAiAgent = vi.fn()

vi.mock('../hooks/useCliAiAgent', () => ({
  useCliAiAgent: (...args: unknown[]) => {
    mockUseCliAiAgent(...args)
    return {
      messages: mockMessages,
      status: mockStatus,
      sendMessage: mockSendMessage,
      stopMessage: mockStopMessage,
      clearConversation: mockClearConversation,
      addLocalMarker: mockAddLocalMarker,
    }
  },
}))

vi.mock('../utils/ai-chat', () => ({
  nextMessageId: () => `msg-${Date.now()}`,
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
  ...overrides,
})

function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(ui, { wrapper: TooltipProvider })
}

function QueuedPromptTargetHarness({ onTargetChange }: { onTargetChange: (targetId: string) => void }) {
  const [input, setInput] = useState('')
  const [targetId, setTargetId] = useState('agent:prime')
  const handleTargetChange = (nextTargetId: string) => {
    onTargetChange(nextTargetId)
    setTargetId(nextTargetId)
  }
  const controller: AiPanelController = {
    agent: {
      messages: [],
      status: 'idle',
      sendMessage: (text: string, references?: NoteReference[]) => {
        mockSendMessage(text, references)
        return Promise.resolve()
      },
      stopMessage: mockStopMessage,
      regenerateMessage: () => Promise.resolve(),
      clearConversation: () => {
        mockClearConversation()
      },
      addLocalMarker: (text: string) => {
        mockAddLocalMarker(text)
      },
    },
    input,
    setInput,
    linkedEntries: [],
    hasContext: false,
    isActive: false,
    permissionMode: 'safe',
    handleSend: (text: string, references: NoteReference[]) => {
      mockSendMessage(text, references)
      setInput('')
    },
    handleStop: mockStopMessage,
    handleNavigateWikilink: vi.fn(),
    handlePermissionModeChange: vi.fn(),
    handleNewChat: vi.fn(),
  }

  return (
    <AiPanelView
      controller={controller}
      onClose={vi.fn()}
      onQueuedPromptTarget={handleTargetChange}
      showHeader={false}
      targetId={targetId}
    />
  )
}

/** The smallest controller `AiPanelView` will render — mirrors the one
 *  `QueuedPromptTargetHarness` builds, without the queued-prompt wiring. */
function primeController(overrides: Partial<AiPanelController> = {}): AiPanelController {
  return {
    agent: {
      messages: [],
      status: 'idle',
      sendMessage: () => Promise.resolve(),
      stopMessage: vi.fn(),
      regenerateMessage: () => Promise.resolve(),
      clearConversation: vi.fn(),
      addLocalMarker: vi.fn(),
    },
    input: '',
    setInput: vi.fn(),
    linkedEntries: [],
    hasContext: false,
    isActive: false,
    permissionMode: 'safe',
    handleSend: vi.fn(),
    handleStop: vi.fn(),
    handleNavigateWikilink: vi.fn(),
    handlePermissionModeChange: vi.fn(),
    handleNewChat: vi.fn(),
    ...overrides,
  }
}

describe('AiPanel', () => {
  beforeEach(() => {
    mockMessages = []
    mockStatus = 'idle'
    mockSendMessage.mockReset()
    mockStopMessage.mockReset()
    mockClearConversation.mockReset()
    mockAddLocalMarker.mockReset()
    mockUseCliAiAgent.mockReset()
    sendToRunningTurnMock.mockReset()
    sendToRunningTurnMock.mockResolvedValue('accepted')
    trackEventMock.mockClear()
    resetVaultConfigStore()
    bindVaultConfigStore({
      zoom: null,
      view_mode: null,
      editor_mode: null,
      note_layout: null,
      tag_colors: null,
      status_colors: null,
      property_display_modes: null,
      inbox: null,
      allNotes: null,
      ai_agent_permission_mode: 'safe',
    }, vi.fn())
  })

  it('renders panel with the default CLI agent header', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByText('Prime')).toBeTruthy()
    expect(screen.getByText('Prime Agent · Harness')).toBeTruthy()
    expect(screen.getByTestId('ai-harness-skills')).toBeTruthy()
    expect(screen.queryByTestId('ai-permission-mode-toggle')).toBeNull()
  })

  it('still seeds the session permission mode from vault config under the hood', () => {
    bindVaultConfigStore({
      ...getVaultConfig(),
      ai_agent_permission_mode: 'power_user',
    }, vi.fn())

    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)

    // Prime UI hides Safe/Power; session still receives stored mode for legacy backends.
    expect(screen.getByText('Prime Agent · Harness')).toBeTruthy()
    expect(mockUseCliAiAgent).toHaveBeenCalledWith(
      '/tmp/vault',
      undefined,
      undefined,
      expect.any(Object),
      expect.objectContaining({ permissionMode: 'power_user' }),
    )
  })

  it('does not expose a permission mode toggle for Prime', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.queryByTestId('ai-permission-mode-toggle')).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Power User' })).toBeNull()
    expect(screen.getByTestId('ai-harness-skills').textContent).toMatch(/rhizome-vault/)
  })

  it('shows working status while the AI agent is running', () => {
    mockStatus = 'thinking'

    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)

    expect(screen.getByText('Prime Agent · working…')).toBeTruthy()
    expect(screen.queryByTestId('ai-permission-mode-toggle')).toBeNull()
  })

  it('replaces the composer send button with a stop button while the AI agent is running', () => {
    mockStatus = 'thinking'

    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)

    expect(screen.queryByTestId('agent-send')).toBeNull()
    const stopButton = screen.getByRole('button', { name: 'Stop response' })
    expect(stopButton).toHaveAttribute('data-testid', 'agent-stop')
    expect(stopButton).not.toBeDisabled()

    fireEvent.click(stopButton)

    expect(mockStopMessage).toHaveBeenCalledOnce()
  })

  it('shows the default toolkit skills strip for Prime', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByTestId('ai-harness-skills')).toHaveTextContent('rhizome-vault')
  })

  it('renders data-testid ai-panel', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByTestId('ai-panel')).toBeTruthy()
  })

  it('caps long AI agent drafts inside a scrollable composer while keeping send visible', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)

    const editor = screen.getByTestId('agent-input')
    editor.textContent = Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join('\n')
    fireEvent.input(editor)

    expect(editor).toHaveClass('max-h-[120px]', 'overflow-y-auto', 'overscroll-contain')
    expect(editor).toHaveStyle({ maxHeight: '120px', overflowY: 'auto' })
    expect(screen.getByTestId('agent-send')).toBeVisible()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    const panel = screen.getByTestId('ai-panel')
    const buttons = panel.querySelectorAll('button')
    const closeBtn = Array.from(buttons).find(b => b.title?.includes('Close'))
    expect(closeBtn).toBeTruthy()
    fireEvent.click(closeBtn!)
    expect(onClose).toHaveBeenCalled()
  })

  it('starts a new AI chat when the header action is clicked', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    fireEvent.click(screen.getByTitle('New AI chat'))
    expect(mockClearConversation).toHaveBeenCalledOnce()
  })

  it('keeps the composer under a note pane', () => {
    render(
      <AiPanel
        onClose={vi.fn()}
        vaultPath="/tmp/vault"
        notePane={<aside data-testid="chat-note-pane">note</aside>}
      />,
    )

    const pane = screen.getByTestId('chat-note-pane')
    const input = screen.getByTestId('agent-input')
    expect(pane.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the MCP config action out of the AI panel header', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)

    expect(screen.queryByRole('button', { name: 'Copy MCP config' })).toBeNull()
  })

  it('renders empty state without context', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByText('Message Prime Agent')).toBeTruthy()
  })

  it('renders contextual empty state when active entry is provided', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} />
    )
    expect(screen.getByText('Message Prime Agent')).toBeTruthy()
  })

  it('does not render a context bar for the active entry', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} />
    )
    expect(screen.queryByTestId('context-bar')).toBeNull()
    expect(screen.queryByText('My Note')).toBeNull()
  })

  it('does not show linked count in a sub-header', () => {
    const linked = makeEntry({ path: '/vault/linked.md', title: 'Linked Note' })
    const entry = makeEntry({ title: 'My Note', outgoingLinks: ['Linked Note'] })
    render(
      <AiPanel
        onClose={vi.fn()} vaultPath="/tmp/vault"
        activeEntry={entry} entries={[entry, linked]}
             />
    )
    expect(screen.queryByText('+ 1 linked')).toBeNull()
    expect(screen.queryByTestId('context-bar')).toBeNull()
  })

  it('renders input field enabled', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const input = screen.getByTestId('agent-input')
    expect(input).toBeTruthy()
    expect(input).toHaveAttribute('contenteditable', 'true')
  })

  it('has send button disabled when input is empty', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const sendBtn = screen.getByTestId('agent-send')
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows active agent placeholder when active entry exists', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} />
    )
    const input = screen.getByTestId('agent-input')
    expect(input).toHaveAttribute('aria-placeholder', 'Ask Prime Agent')
  })

  it('shows active agent placeholder when no active entry', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const input = screen.getByTestId('agent-input')
    expect(input).toHaveAttribute('aria-placeholder', 'Ask Prime Agent')
  })

  it('uses the selected AI agent in the placeholder', () => {
    render(
      <AiPanel
        onClose={vi.fn()}
        vaultPath="/tmp/vault"
        defaultAiAgent="codex"
        defaultAiAgentReady
      />,
    )
    expect(screen.getByTestId('agent-input')).toHaveAttribute('aria-placeholder', 'Ask Codex')
  })

  it('disables sending while the selected AI agent is still loading', () => {
    render(
      <AiPanel
        onClose={vi.fn()}
        vaultPath="/tmp/vault"
        defaultAiAgent="codex"
        defaultAiAgentReadiness="checking"
      />,
    )

    expect(screen.getByText('Checking availability')).toBeTruthy()
    expect(screen.getByTestId('agent-input')).toHaveAttribute('aria-placeholder', 'Checking AI agent availability...')
    expect(screen.getByTestId('agent-send')).toBeDisabled()
  })

  it('auto-focuses input on mount', async () => {
    vi.useFakeTimers()
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    await act(() => { vi.advanceTimersByTime(1) })
    const input = screen.getByTestId('agent-input')
    expect(document.activeElement).toBe(input)
    vi.useRealTimers()
  })

  it('focuses the panel shell when reopening with existing messages', async () => {
    vi.useFakeTimers()
    mockMessages = [{
      userMessage: 'Remember this',
      actions: [],
      response: 'Still here.',
      id: 'msg-3',
    }]
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    await act(() => { vi.advanceTimersByTime(1) })
    expect(document.activeElement).toBe(screen.getByTestId('ai-panel'))
    vi.useRealTimers()
  })

  it('does not steal composer focus after a response when the send button becomes enabled', async () => {
    vi.useFakeTimers()
    mockMessages = [{
      userMessage: 'First question',
      actions: [],
      response: 'First answer.',
      id: 'msg-3',
    }]
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)

    const input = screen.getByTestId('agent-input')
    input.focus()
    input.textContent = 'f'
    fireEvent.input(input)

    await act(() => { vi.advanceTimersByTime(1) })

    expect(screen.getByTestId('agent-send')).toBeEnabled()
    expect(document.activeElement).toBe(screen.getByTestId('agent-input'))
    vi.useRealTimers()
  })

  it('calls onClose when Escape is pressed while panel has focus', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    await act(() => { vi.advanceTimersByTime(1) })
    // Input is focused inside the panel, so Escape should trigger onClose
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls onClose when Escape is pressed on panel element', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    const panel = screen.getByTestId('ai-panel')
    panel.focus()
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking a wikilink in AI response calls onOpenNote with the target', () => {
    mockMessages = [{
      userMessage: 'Tell me about notes',
      actions: [],
      response: 'Check out [[Build Laputa App]] for details.',
      id: 'msg-1',
    }]
    const onOpenNote = vi.fn()
    const { container } = render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" onOpenNote={onOpenNote} />,
    )
    const wikilink = container.querySelector('.chat-wikilink')
    expect(wikilink).toBeTruthy()
    expect(wikilink!.textContent).toBe('Build Laputa App')
    fireEvent.click(wikilink!)
    expect(onOpenNote).toHaveBeenCalledWith('Build Laputa App')
  })

  it('renders wikilinks with special characters and clicking works', () => {
    mockMessages = [{
      userMessage: 'Tell me about meetings',
      actions: [],
      response: 'See [[Meeting — 2024/01/15]] and [[Pasta Carbonara]].',
      id: 'msg-2',
    }]
    const onOpenNote = vi.fn()
    const { container } = render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" onOpenNote={onOpenNote} />,
    )
    const wikilinks = container.querySelectorAll('.chat-wikilink')
    expect(wikilinks).toHaveLength(2)
    fireEvent.click(wikilinks[0])
    expect(onOpenNote).toHaveBeenCalledWith('Meeting — 2024/01/15')
    fireEvent.click(wikilinks[1])
    expect(onOpenNote).toHaveBeenCalledWith('Pasta Carbonara')
  })

  it('auto-sends a queued prompt from the command palette bridge', async () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" entries={[makeEntry({ path: '/vault/alpha.md', filename: 'alpha.md', title: 'Alpha', isA: 'Project' })]} />)

    await act(async () => {
      queueAiPrompt('summarize [[alpha]]', [
        { title: 'Alpha', path: '/vault/alpha.md', type: 'Project' },
      ])
    })

    expect(mockClearConversation).toHaveBeenCalledOnce()
    expect(mockSendMessage).toHaveBeenCalledWith('summarize [[alpha]]', [
      { title: 'Alpha', path: '/vault/alpha.md', type: 'Project' },
    ])
    expect(screen.getByTestId('agent-send')).toBeDisabled()
  })

  it('retargets a queued prompt before sending when the active target differs', async () => {
    const onTargetChange = vi.fn()
    render(<QueuedPromptTargetHarness onTargetChange={onTargetChange} />)

    await act(async () => {
      queueAiPrompt('ask codex', [], 'agent:codex')
    })

    await waitFor(() => {
      expect(onTargetChange).toHaveBeenCalledWith('agent:codex')
      expect(mockClearConversation).toHaveBeenCalledOnce()
      expect(mockSendMessage).toHaveBeenCalledWith('ask codex', [])
    })
  })

  /**
   * Was: a pasted image raised the unsupported-paste notice. Prime accepts
   * images (`docs/rpc.md`), so a screenshot is now attached instead — the
   * refusal was ours. The paste must still stay out of the *text*, which is
   * what the second assertion always guarded.
   */
  it('attaches a pasted image instead of refusing it', async () => {
    const onUnsupportedAiPaste = vi.fn()
    const entry = makeEntry({ title: 'My Note' })

    render(
      <AiPanel
        onClose={vi.fn()}
        vaultPath="/tmp/vault"
        activeEntry={entry}
        entries={[entry]}
        onUnsupportedAiPaste={onUnsupportedAiPaste}
      />,
    )

    fireEvent.paste(screen.getByTestId('agent-input'), {
      clipboardData: {
        getData: vi.fn(() => ''),
        files: [new File(['image'], 'paste.png', { type: 'image/png' })],
        items: [{ kind: 'file', type: 'image/png' }],
      },
    })

    expect(await screen.findByTestId('composer-attachments')).toBeInTheDocument()
    expect(screen.getByText('paste.png')).toBeInTheDocument()
    expect(onUnsupportedAiPaste).not.toHaveBeenCalledWith(UNSUPPORTED_INLINE_PASTE_MESSAGE)
    expect(screen.getByTestId('agent-input').textContent).not.toContain('paste.png')
  })

  /** Everything that is not an image is still refused, unchanged. */
  it('still refuses a pasted file that is not an image', () => {
    const onUnsupportedAiPaste = vi.fn()
    const entry = makeEntry({ title: 'My Note' })

    render(
      <AiPanel
        onClose={vi.fn()}
        vaultPath="/tmp/vault"
        activeEntry={entry}
        entries={[entry]}
        onUnsupportedAiPaste={onUnsupportedAiPaste}
      />,
    )

    fireEvent.paste(screen.getByTestId('agent-input'), {
      clipboardData: {
        getData: vi.fn(() => ''),
        files: [new File(['pdf'], 'paper.pdf', { type: 'application/pdf' })],
        items: [{ kind: 'file', type: 'application/pdf' }],
      },
    })

    expect(onUnsupportedAiPaste).toHaveBeenCalledWith(UNSUPPORTED_INLINE_PASTE_MESSAGE)
    expect(screen.queryByTestId('composer-attachments')).not.toBeInTheDocument()
  })
})

/**
 * The column already rendered to the left of the transcript — it just started
 * closed, so the window people land on had no sign that other sessions
 * existed (visual audit, 2026-08-20). Asserting the control's pressed state
 * rather than the request behind it: the bug was what the screen showed.
 */
describe('Chat home opens with its sessions column', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  function renderPrimePanel() {
    return render(
      <AiPanelView
        controller={primeController()}
        onClose={vi.fn()}
        showHeader={false}
        targetId="agent:prime"
      />,
    )
  }

  it('shows the column on a machine with no stored preference', () => {
    renderPrimePanel()
    expect(screen.getByRole('button', { name: 'Close sessions' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('remembers a person who closed it', () => {
    renderPrimePanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close sessions' }))

    expect(screen.getByRole('button', { name: 'Open sessions' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(localStorage.getItem(APP_STORAGE_KEYS.chatSessionsOpen)).toBe('0')
  })

  it('starts closed when that is what the machine remembers', () => {
    localStorage.setItem(APP_STORAGE_KEYS.chatSessionsOpen, '0')
    renderPrimePanel()
    expect(screen.getByRole('button', { name: 'Open sessions' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

/**
 * The visual audit found Goal in two places: hard left with no context meter,
 * far right once a session reported usage. `justify-between` on a row whose
 * first child renders null puts the survivor on the left, so the button moved
 * because of state the user never chose.
 */
describe('the Goal button has one home', () => {
  function goalRow() {
    render(
      <AiPanelView
        controller={primeController()}
        onClose={vi.fn()}
        showHeader={false}
        targetId="agent:prime"
      />,
    )
    return screen.getByTestId('prime-goal-trigger').parentElement
  }

  it('keeps the meter’s slot even when the meter shows nothing', () => {
    const row = goalRow()

    // Two slots, always: whatever the meter decides to render, and the button.
    expect(row?.querySelector('[data-testid="prime-context-meter-slot"]')).toBeInTheDocument()
    expect(row?.className).not.toContain('justify-between')
  })
})

/**
 * #41. Prime's daemon has taken `steer` and `follow_up` all along, both
 * exposed as Tauri commands and tested in Rust, and `AiPanelComposer` has
 * rendered a Steer button for a typed-into composer during a turn — with
 * seven passing tests. Nothing ever passed `onSteer`, so `canSteer` was
 * always false, the composer locked, and the only control was Stop.
 *
 * Asserting the wiring rather than the handler: the whole defect was one
 * absent prop, and a component test of the composer cannot see it.
 */
describe('talking to a turn that is already running', () => {
  function renderActivePrime(input: string) {
    return render(
      <AiPanelView
        controller={primeController({ isActive: true, input })}
        onClose={vi.fn()}
        showHeader={false}
        targetId="agent:prime"
      />,
    )
  }

  it('offers Steer once something is typed during a turn', () => {
    renderActivePrime('focus on error handling')

    expect(screen.getByRole('button', { name: 'Steer response' })).toBeInTheDocument()
  })

  it('shows nothing queued before anything is queued', () => {
    renderActivePrime('')

    expect(screen.queryByTestId('composer-queued-follow-ups')).toBeNull()
  })

  it('still offers Stop when the composer is empty', () => {
    renderActivePrime('')

    expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument()
  })

  it('sends a declined follow-up as a new turn after the running turn ends', async () => {
    let resolveFollowUp: (result: 'not-running') => void = () => {}
    sendToRunningTurnMock.mockReturnValue(new Promise((resolve) => {
      resolveFollowUp = resolve
    }))
    const staleActiveSend = vi.fn()
    const latestIdleSend = vi.fn()
    const renderPanel = (controller: AiPanelController) => (
      <AiPanelView
        controller={controller}
        onClose={vi.fn()}
        showHeader={false}
        targetId="agent:prime"
      />
    )
    const { rerender } = render(renderPanel(primeController({
      isActive: true,
      input: 'then summarise',
      handleSend: staleActiveSend,
    })))

    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })
    rerender(renderPanel(primeController({
      isActive: false,
      input: 'then summarise',
      handleSend: latestIdleSend,
    })))
    await act(async () => resolveFollowUp('not-running'))

    expect(latestIdleSend).toHaveBeenCalledWith('then summarise', [], undefined)
    expect(staleActiveSend).not.toHaveBeenCalled()
  })

  it('keeps the draft when the follow-up transport fails', async () => {
    sendToRunningTurnMock.mockResolvedValue('failed')
    const handleSend = vi.fn()
    const setInput = vi.fn()
    render(
      <AiPanelView
        controller={primeController({
          isActive: true,
          input: 'do not lose this',
          handleSend,
          setInput,
        })}
        onClose={vi.fn()}
        showHeader={false}
        targetId="agent:prime"
      />,
    )

    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })
    await act(async () => {})

    expect(handleSend).not.toHaveBeenCalled()
    expect(setInput).not.toHaveBeenCalled()
    expect(screen.getByTestId('agent-input')).toHaveTextContent('do not lose this')
  })

  // Prime can report "no turn running" while the panel still shows one, because
  // the UI learns a turn ended from a later event. The fallback deliberately
  // does not start a turn from that stale-active state, so the guarantee is the
  // draft: the text stays in the composer and Enter works again once idle.
  it('keeps a declined message in the composer when the panel still looks active', async () => {
    sendToRunningTurnMock.mockResolvedValue('not-running')
    const handleSend = vi.fn()
    const setInput = vi.fn()
    render(
      <AiPanelView
        controller={primeController({
          isActive: true,
          input: 'still worth keeping',
          handleSend,
          setInput,
        })}
        onClose={vi.fn()}
        showHeader={false}
        targetId="agent:prime"
      />,
    )

    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })
    await act(async () => {})

    expect(handleSend).not.toHaveBeenCalled()
    expect(setInput).not.toHaveBeenCalled()
    expect(screen.getByTestId('agent-input')).toHaveTextContent('still worth keeping')
  })
})
