import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatus, AiAgentMessage } from './aiAgentConversation'

const { detectFileOperationMock, trackEventMock, queueSessionAutoDistillMock } = vi.hoisted(() => ({
  detectFileOperationMock: vi.fn(),
  trackEventMock: vi.fn(),
  queueSessionAutoDistillMock: vi.fn(),
}))

vi.mock('./aiAgentFileOperations', async (importOriginal) => ({
  ...await importOriginal<typeof import('./aiAgentFileOperations')>(),
  detectFileOperation: detectFileOperationMock,
}))

vi.mock('./telemetry', () => ({
  trackEvent: trackEventMock,
}))

vi.mock('../utils/sessionAutoDistill', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/sessionAutoDistill')>()
  return {
    ...actual,
    queueSessionAutoDistill: queueSessionAutoDistillMock,
  }
})

import { createStreamCallbacks } from './aiAgentStreamCallbacks'
import { conversationToNativeEvents } from './nativeChatTranscript'
import { translate } from './i18n'

function createMessageStore(initialMessages: AiAgentMessage[]) {
  let messages = initialMessages

  return {
    getMessages: () => messages,
    setMessages: (next: AiAgentMessage[] | ((current: AiAgentMessage[]) => AiAgentMessage[])) => {
      messages = typeof next === 'function' ? next(messages) : next
    },
  }
}

function createStatusStore(initialStatus: AgentStatus = 'idle') {
  let status = initialStatus

  return {
    getStatus: () => status,
    setStatus: (next: AgentStatus | ((current: AgentStatus) => AgentStatus)) => {
      status = typeof next === 'function' ? next(status) : next
    },
  }
}

describe('aiAgentStreamCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trackEventMock.mockClear()
    queueSessionAutoDistillMock.mockReset()
    queueSessionAutoDistillMock.mockResolvedValue({ queued: false, redactedCount: 0 })
  })

  it('handles the happy-path lifecycle and refreshes the vault at the end', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore()
    const fileCallbacks = { onVaultChanged: vi.fn() }
    const responseAccRef = { current: '' }
    const toolInputMapRef = { current: new Map<string, { tool: string; input?: string }>() }

    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef,
      fileCallbacksRef: { current: fileCallbacks },
    })

    callbacks.onThinking('step 1')
    callbacks.onText('Hello')
    callbacks.onToolStart('Write', 'tool-1', '{"path":"/vault/note.md"}')
    callbacks.onToolStart('Write', 'tool-1')
    callbacks.onToolDone('tool-1', 'saved')
    callbacks.onDone()

    expect(status.getStatus()).toBe('done')
    expect(responseAccRef.current).toBe('Hello')
    expect(toolInputMapRef.current.get('tool-1')).toEqual({
      tool: 'Write',
      input: '{"path":"/vault/note.md"}',
    })
    expect(detectFileOperationMock).toHaveBeenCalledWith({
      toolName: 'Write',
      input: '{"path":"/vault/note.md"}',
      vaultPath: '/vault',
      callbacks: fileCallbacks,
    })
    expect(fileCallbacks.onVaultChanged).toHaveBeenCalledTimes(1)
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_response_completed', {
      agent: 'claude_code',
      had_text: 1,
      tool_count: 1,
    })
    expect(messages.getMessages()).toEqual([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [{
          tool: 'Write',
          toolId: 'tool-1',
          // Tool cards carry the note path so the card can offer "Open".
          label: 'Wrote file · /vault/note.md',
          path: '/vault/note.md',
          status: 'done',
          input: '{"path":"/vault/note.md"}',
          output: 'saved',
          beforeText: 'Hello',
        }],
        isStreaming: false,
        reasoning: 'step 1',
        reasoningDone: true,
        response: 'Hello',
      },
    ])
  })

  it.each([
    ['claude_code', 'claude_code'],
    ['native', 'prime'],
  ] as const)('keeps a pre-tool-only displayed response on %s', (_engine, agent) => {
      const messages = createMessageStore([
        {
          id: 'msg-1',
          userMessage: 'Question',
          actions: [],
          isStreaming: true,
        },
      ])
      const responseAccRef = { current: '' }
      const callbacks = createStreamCallbacks({
        agent,
        messageId: 'msg-1',
        vaultPath: '/vault',
        setMessages: messages.setMessages,
        setStatus: createStatusStore().setStatus,
        abortRef: { current: { aborted: false } },
        responseAccRef,
        toolInputMapRef: { current: new Map() },
        fileCallbacksRef: { current: undefined },
      })

      callbacks.onText('Hello')
      callbacks.onToolStart('search', 't1', '{}')
      callbacks.onToolDone('t1', 'hits')
      callbacks.onDone()

      expect(responseAccRef.current).toBe('Hello')
      expect(messages.getMessages()[0].response).toBe('Hello')
      expect(messages.getMessages()[0].actions[0].beforeText).toBe('Hello')
      expect(conversationToNativeEvents(messages.getMessages())).toEqual([
        { User: { text: 'Question' } },
        { Assistant: { text: 'Hello' } },
        { ToolCall: { id: 't1', name: 'search', args: '{}' } },
        { ToolResult: { id: 't1', name: 'search', output: 'hits' } },
        'TurnEnd',
      ])
    },
  )

  it.each([
    ['claude_code', 'claude_code'],
    ['native', 'prime'],
  ] as const)('forks a live %s chat with assistant text still in front of its tool round', (_engine, agent) => {
      const messages = createMessageStore([
        {
          id: 'msg-1',
          userMessage: 'Do both',
          actions: [],
          isStreaming: true,
        },
      ])
      const callbacks = createStreamCallbacks({
        agent,
        messageId: 'msg-1',
        vaultPath: '/vault',
        setMessages: messages.setMessages,
        setStatus: createStatusStore().setStatus,
        abortRef: { current: { aborted: false } },
        responseAccRef: { current: '' },
        toolInputMapRef: { current: new Map() },
        fileCallbacksRef: { current: undefined },
      })

      callbacks.onText('I will search first')
      callbacks.onToolStart('search', 't1', '{}')
      callbacks.onToolDone('t1', 'hits')
      callbacks.onText('Here is the answer')
      callbacks.onDone()

      expect(messages.getMessages()[0].response).toBe('I will search firstHere is the answer')
      expect(messages.getMessages()[0].actions[0].beforeText).toBe('I will search first')
      expect(conversationToNativeEvents(messages.getMessages())).toEqual([
        { User: { text: 'Do both' } },
        { Assistant: { text: 'I will search first' } },
        { ToolCall: { id: 't1', name: 'search', args: '{}' } },
        { ToolResult: { id: 't1', name: 'search', output: 'hits' } },
        { Assistant: { text: 'Here is the answer' } },
        'TurnEnd',
      ])
    },
  )

  it('records only the slice since the previous tool start as beforeText', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Do both',
        actions: [],
        isStreaming: true,
      },
    ])
    const callbacks = createStreamCallbacks({
      agent: 'prime',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onText('I will search first')
    callbacks.onToolStart('search', 't1', '{}')
    callbacks.onToolDone('t1', 'hits')
    callbacks.onText('Now I will write')
    callbacks.onToolStart('write', 't2', '{}')
    callbacks.onToolDone('t2', 'ok')
    callbacks.onText('Here is the answer')
    callbacks.onDone()

    const message = messages.getMessages()[0]
    expect(message.response).toBe('I will search firstNow I will writeHere is the answer')
    expect(message.actions[0].beforeText).toBe('I will search first')
    expect(message.actions[1].beforeText).toBe('Now I will write')
    expect(conversationToNativeEvents(messages.getMessages())).toEqual([
      { User: { text: 'Do both' } },
      { Assistant: { text: 'I will search first' } },
      { ToolCall: { id: 't1', name: 'search', args: '{}' } },
      { ToolResult: { id: 't1', name: 'search', output: 'hits' } },
      { Assistant: { text: 'Now I will write' } },
      { ToolCall: { id: 't2', name: 'write', args: '{}' } },
      { ToolResult: { id: 't2', name: 'write', output: 'ok' } },
      { Assistant: { text: 'Here is the answer' } },
      'TurnEnd',
    ])
  })

  it('truncates large tool output retained in message history', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onToolStart('Bash', 'tool-1')
    callbacks.onToolDone('tool-1', 'x'.repeat(20_050))

    const output = messages.getMessages()[0].actions[0].output
    expect(output?.length).toBeLessThan(20_050)
    expect(output).toContain('[Tool output truncated: 50 chars omitted]')
  })

  it('keeps failed MCP create_note results from reporting a created file', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Create a verification note',
        actions: [],
        isStreaming: true,
      },
    ])
    const fileCallbacks = {
      onFileCreated: vi.fn(),
      onVaultChanged: vi.fn(),
    }
    const callbacks = createStreamCallbacks({
      agent: 'pi',
      messageId: 'msg-1',
      vaultPath: String.raw`H:\Notes`,
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: fileCallbacks },
    })
    const output = JSON.stringify({
      content: [{
        type: 'text',
        text: 'Error: Failed to create H:/Notes/test-tool-verification.md: Access is denied',
      }],
      isError: true,
    })

    callbacks.onToolStart(
      'create_note',
      'tool-1',
      JSON.stringify({ path: 'H:/Notes/test-tool-verification.md' }),
    )
    callbacks.onToolDone('tool-1', output)

    expect(detectFileOperationMock).not.toHaveBeenCalled()
    expect(fileCallbacks.onFileCreated).not.toHaveBeenCalled()
    expect(fileCallbacks.onVaultChanged).not.toHaveBeenCalled()
    expect(messages.getMessages()[0].actions[0]).toMatchObject({
      tool: 'create_note',
      toolId: 'tool-1',
      status: 'error',
      output,
    })
  })

  it('repairs missing sentence boundaries between streamed text chunks', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const responseAccRef = { current: '' }

    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onText("I'll create the Project note now.")
    callbacks.onText('Created [[Tolaria Mobile]] as a Project note with a relation to [[frontend]].')
    callbacks.onText('It covers three tech stack paths.')
    callbacks.onDone()

    expect(messages.getMessages()[0].response).toBe(
      "I'll create the Project note now. Created [[Tolaria Mobile]] as a Project note with a relation to [[frontend]]. It covers three tech stack paths.",
    )
  })

  it('keeps response normalization compatible with WebKit regex syntax support', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/aiAgentStreamCallbacks.ts'), 'utf8')

    expect(source).not.toMatch(/\(\?<[!=]/u)
  })

  it('marks pending actions as failed when the stream errors', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [{
          tool: 'Bash',
          toolId: 'tool-1',
          label: 'Ran shell command',
          status: 'pending',
        }],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')
    const responseAccRef = { current: 'Partial reply' }

    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onError('boom')
    callbacks.onDone()

    expect(status.getStatus()).toBe('error')
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_response_failed', {
      agent: 'claude_code',
      error_kind: 'stream_error',
      had_partial_response: 1,
      tool_count: 0,
    })
    expect(messages.getMessages()).toEqual([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [{
          tool: 'Bash',
          toolId: 'tool-1',
          label: 'Ran shell command',
          status: 'error',
        }],
        isStreaming: false,
        reasoningDone: true,
        response: 'Partial reply\n\nError: boom',
      },
    ])
    expect(trackEventMock).not.toHaveBeenCalledWith('ai_agent_response_completed', expect.anything())
  })

  it('shows a non-fatal notice without ending the turn or disabling Send', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')
    const responseAccRef = { current: 'Partial reply' }

    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onNotice?.(
      "This part of the chat couldn't be saved, so it won't be there after a restart.",
    )
    callbacks.onNotice?.(
      "This part of the chat couldn't be saved, so it won't be there after a restart.",
    )
    callbacks.onText(' more')
    callbacks.onDone()

    expect(status.getStatus()).toBe('done')
    expect(responseAccRef.current).toBe('Partial reply more')
    expect(messages.getMessages()).toMatchObject([
      {
        id: 'msg-1',
        userMessage: 'Question',
        isStreaming: false,
        response: 'Partial reply more',
      },
      {
        localMarker:
          "This part of the chat couldn't be saved, so it won't be there after a restart.",
        localMarkerTone: 'warning',
      },
    ])
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_response_completed', expect.objectContaining({
      agent: 'claude_code',
    }))
    expect(messages.getMessages().filter((message) => message.localMarker)).toHaveLength(1)
  })

  it('localizes Pi empty-output stream errors with diagnostic output', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const diagnosticOutput = 'npm warn exec installing pi-mcp-adapter'
    const callbacks = createStreamCallbacks({
      agent: 'pi',
      locale: 'it-IT',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onError(`rhizome:i18n-error:${JSON.stringify({
      key: 'ai.error.pi.emptyOutputWithDiagnostic',
      values: { diagnostic_output: diagnosticOutput },
    })}`)

    expect(messages.getMessages()[0].response).toBe(
      `Error: ${translate('it-IT', 'ai.error.pi.emptyOutputWithDiagnostic', { diagnostic_output: diagnosticOutput })}`,
    )
  })

  it.each([
    ['claude_code', 'Claude Code finished without returning a reply.'],
    ['pi', 'Pi finished without returning a reply.'],
  ] as const)('uses the %s label for empty stream responses', (agent, response) => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: '/exit',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')

    const callbacks = createStreamCallbacks({
      agent,
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onDone()

    expect(status.getStatus()).toBe('done')
    expect(trackEventMock).toHaveBeenCalledWith('ai_agent_response_completed', {
      agent,
      had_text: 0,
      tool_count: 0,
    })
    expect(messages.getMessages()).toEqual([
      {
        id: 'msg-1',
        userMessage: '/exit',
        actions: [],
        isStreaming: false,
        reasoningDone: true,
        response,
      },
    ])
  })

  /**
   * Thinking-only then Done is an empty completion, not a provider rejection.
   * The host never treats thinking_delta as assistant text. The frontend must
   * not rewrite that into a refusal. Thinking Off is a user control, not this
   * path's default.
   */
  it('keeps thinking-only completion as a generic empty reply', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'What is 2+2?',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')
    const responseAccRef = { current: '' }

    const callbacks = createStreamCallbacks({
      agent: 'prime',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onThinking('The user asked a simple arithmetic question. ')
    callbacks.onThinking('I should add two and two.')
    callbacks.onDone()

    expect(status.getStatus()).toBe('done')
    expect(messages.getMessages()[0].reasoning).toContain('simple arithmetic')
    expect(messages.getMessages()[0].response).toBe(
      'Prime finished without returning a reply.',
    )
    expect(messages.getMessages()[0].response).not.toContain('rejected this request')
  })

  it('surfaces a provider rejection instead of the generic empty reply', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'hello',
        actions: [],
        isStreaming: true,
      },
    ])
    const callbacks = createStreamCallbacks({
      agent: 'prime',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onError('openrouter rejected this request before it ran (no input tokens).')

    expect(messages.getMessages()[0].response).toBe(
      'Error: openrouter rejected this request before it ran (no input tokens).',
    )
    expect(messages.getMessages()[0].response).not.toContain('finished without returning a reply')
  })

  it('surfaces a worker-startup error instead of the generic empty reply', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'hello',
        actions: [],
        isStreaming: true,
      },
    ])
    const callbacks = createStreamCallbacks({
      agent: 'prime',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: createStatusStore().setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onError(
      'Prime Agent is not authenticated. Run `prime-agent` once in a terminal and complete login (including xAI OAuth if needed), then retry.',
    )

    expect(messages.getMessages()[0].response).toContain('Prime Agent is not authenticated')
    expect(messages.getMessages()[0].response).not.toContain('finished without returning a reply')
  })

  it('gives OpenCode an actionable empty-response message', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Summarize the current note',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')

    const callbacks = createStreamCallbacks({
      agent: 'opencode',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onDone()

    expect(status.getStatus()).toBe('done')
    expect(messages.getMessages()[0].response).toContain('OpenCode returned no assistant text')
    expect(messages.getMessages()[0].response).toContain('provider/model context limit')
    expect(messages.getMessages()[0].response).not.toContain('finished without returning a reply')
  })

  it('ignores stream events after the request has been aborted', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')
    const fileCallbacks = { onVaultChanged: vi.fn() }

    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: true } },
      responseAccRef: { current: '' },
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: fileCallbacks },
    })

    callbacks.onThinking('ignored')
    callbacks.onText('ignored')
    callbacks.onToolStart('Write', 'tool-1', '{"path":"/vault/note.md"}')
    callbacks.onToolDone('tool-1', 'saved')
    callbacks.onError('boom')
    callbacks.onDone()

    expect(status.getStatus()).toBe('thinking')
    expect(messages.getMessages()[0]).toEqual({
      id: 'msg-1',
      userMessage: 'Question',
      actions: [],
      isStreaming: true,
    })
    expect(fileCallbacks.onVaultChanged).not.toHaveBeenCalled()
    expect(detectFileOperationMock).not.toHaveBeenCalled()
  })

  it('marks the transcript when auto-distill strips credentials', async () => {
    queueSessionAutoDistillMock.mockResolvedValue({ queued: true, redactedCount: 2 })
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Question',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore()
    const responseAccRef = { current: '' }

    const callbacks = createStreamCallbacks({
      agent: 'claude_code',
      locale: 'en',
      messageId: 'msg-1',
      vaultPath: '/vault',
      userMessage: 'Question',
      sessionAutoDistillEnabled: true,
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: {} },
    })

    callbacks.onText('A'.repeat(80))
    callbacks.onDone()
    await queueSessionAutoDistillMock.mock.results[0]?.value

    expect(queueSessionAutoDistillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vaultPath: '/vault',
        userMessage: 'Question',
      }),
    )
    expect(trackEventMock).toHaveBeenCalledWith('vault_credentials_handled', {
      source: 'auto_distill',
      action: 'redact',
      count: 2,
    })
    const marker = messages.getMessages().find((message) => message.localMarker)
    expect(marker?.localMarker).toBe('Removed 2 credentials before saving this turn to the wiki')
  })

  it('returns to idle after a tool then a sealed reply once Done arrives', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'Are you still there?',
        actions: [],
        isStreaming: true,
      },
    ])
    const status = createStatusStore('thinking')
    const responseAccRef = { current: '' }
    const callbacks = createStreamCallbacks({
      agent: 'prime',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onToolStart('ipython', 'ipy-1', '{"code":"1+1"}')
    expect(status.getStatus()).toBe('tool-executing')
    callbacks.onToolDone('ipy-1', '2')
    callbacks.onText('Hi — still here.')
    callbacks.onTurnBoundary()

    // The host may still be in the follow-up grace. Working stays until Done.
    expect(status.getStatus()).toBe('thinking')
    expect(messages.getMessages()[0]).toMatchObject({
      id: 'msg-1',
      response: 'Hi — still here.',
      isStreaming: false,
    })

    callbacks.onDone()
    expect(status.getStatus()).toBe('done')
  })

  it('seals the first turn and streams the follow-up into its own bubble', () => {
    const messages = createMessageStore([
      {
        id: 'msg-1',
        userMessage: 'First ask',
        actions: [],
        isStreaming: true,
      },
      {
        id: 'msg-follow',
        userMessage: 'MIDTURN_QUEUE_PROBE',
        actions: [],
        queuedFollowUp: true,
      },
    ])
    const status = createStatusStore()
    const responseAccRef = { current: '' }
    const callbacks = createStreamCallbacks({
      agent: 'prime',
      messageId: 'msg-1',
      vaultPath: '/vault',
      setMessages: messages.setMessages,
      setStatus: status.setStatus,
      abortRef: { current: { aborted: false } },
      responseAccRef,
      toolInputMapRef: { current: new Map() },
      fileCallbacksRef: { current: undefined },
    })

    callbacks.onText('first-turn-done')
    callbacks.onTurnBoundary()
    expect(status.getStatus()).toBe('thinking')
    expect(messages.getMessages()[0]).toMatchObject({
      id: 'msg-1',
      response: 'first-turn-done',
      isStreaming: false,
    })
    expect(messages.getMessages()[1]).toMatchObject({
      id: 'msg-follow',
      isStreaming: true,
    })
    expect(messages.getMessages()[1].queuedFollowUp).toBeUndefined()
    expect(responseAccRef.current).toBe('')

    callbacks.onText('follow-up-ack')
    callbacks.onTurnBoundary()
    callbacks.onDone()

    expect(status.getStatus()).toBe('done')
    expect(messages.getMessages()[1]).toMatchObject({
      id: 'msg-follow',
      response: 'follow-up-ack',
      isStreaming: false,
    })
    expect(messages.getMessages()[0].response).toBe('first-turn-done')
  })
})
