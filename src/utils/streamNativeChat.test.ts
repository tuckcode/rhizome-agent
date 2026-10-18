import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStreamCallbacks } from './streamAiAgent'
import {
  NATIVE_NO_KEY_GUIDANCE,
  applyNativeEvent,
  nativeChatUserError,
  streamNativeChat,
} from './streamNativeChat'

const {
  invokeMock,
  isTauriState,
  listenMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriState: { value: false },
  listenMock: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => isTauriState.value,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}))

function callbacks(): AgentStreamCallbacks {
  return {
    onText: vi.fn(),
    onThinking: vi.fn(),
    onToolStart: vi.fn(),
    onToolDone: vi.fn(),
    onError: vi.fn(),
    onNotice: vi.fn(),
    onDone: vi.fn(),
  }
}

describe('native chat user errors', () => {
  it('tells the user where to add a key instead of Prime install text', () => {
    expect(nativeChatUserError(
      'Prime Agent is not available on this machine. Install it with `npm i -g prime-agent`.',
    )).toBe(`This native chat needs an API key. ${NATIVE_NO_KEY_GUIDANCE}`)
    expect(nativeChatUserError('No local API key is saved for OpenAI.')).toBe(
      `No local API key is saved for OpenAI. ${NATIVE_NO_KEY_GUIDANCE}`,
    )
    expect(NATIVE_NO_KEY_GUIDANCE).toContain('Settings → AI Agents → API models')
  })

  it('points at Settings for the default Free tier missing-key error', () => {
    expect(nativeChatUserError('No free-tier provider key is set.')).toBe(
      `No free-tier provider key is set. ${NATIVE_NO_KEY_GUIDANCE}`,
    )
  })

  it('leaves a locked or denied keychain error unchanged', () => {
    const message = 'The keychain could not be read for groq. It may be locked, or access was denied.'
    expect(nativeChatUserError(message)).toBe(message)
  })
})

describe('native stream events', () => {
  it('rewrites a fatal error event and ends the stream so the composer can send again', () => {
    const next = callbacks()
    const ended = applyNativeEvent({
      kind: 'error',
      fatal: true,
      message: 'Prime Agent is not available on this machine. Install it with `npm i -g prime-agent`.',
    }, next)
    expect(ended).toBe(true)
    expect(next.onError).toHaveBeenCalledWith(
      `This native chat needs an API key. ${NATIVE_NO_KEY_GUIDANCE}`,
    )
    expect(next.onNotice).not.toHaveBeenCalled()
    expect(next.onDone).not.toHaveBeenCalled()
  })

  it('does not end the stream on a non-fatal error, so later text still appends', () => {
    const next = callbacks()
    expect(applyNativeEvent({
      kind: 'error',
      fatal: false,
      message: "This part of the chat couldn't be saved, so it won't be there after a restart.",
    }, next)).toBe(false)
    expect(next.onError).not.toHaveBeenCalled()
    expect(next.onNotice).toHaveBeenCalledWith(
      "This part of the chat couldn't be saved, so it won't be there after a restart.",
    )
    expect(applyNativeEvent({ kind: 'text_delta', text: 'later' }, next)).toBe(false)
    expect(next.onText).toHaveBeenCalledWith('later')
  })

  it('treats an error event with no fatal field as fatal', () => {
    const next = callbacks()
    expect(applyNativeEvent({
      kind: 'error',
      message: 'No free-tier provider key is set.',
    }, next)).toBe(true)
    expect(next.onError).toHaveBeenCalledWith(
      `No free-tier provider key is set. ${NATIVE_NO_KEY_GUIDANCE}`,
    )
    expect(next.onNotice).not.toHaveBeenCalled()
  })

  it('does not end the stream on a text delta', () => {
    const next = callbacks()
    expect(applyNativeEvent({ kind: 'text_delta', text: 'hi' }, next)).toBe(false)
    expect(next.onText).toHaveBeenCalledWith('hi')
  })

  it('surfaces an approval card payload without ending the stream', () => {
    const next = callbacks()
    next.onApprovalRequested = vi.fn()
    expect(applyNativeEvent({
      kind: 'approval_requested',
      prompt_id: 'prompt_1',
      tool: 'write_file',
      args: '{"path":"fresh.md","content":"hello\\n"}',
      path: 'fresh.md',
      preview: '--- /dev/null\n+++ fresh.md\n+hello\n',
      created: true,
      overwrite: false,
      call_id: 'call_1',
      options: [
        { id: 'allow_once', label: 'Allow once' },
        { id: 'allow_session', label: 'Allow for session' },
        { id: 'deny', label: 'Deny' },
      ],
    }, next)).toBe(false)
    expect(next.onApprovalRequested).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'prompt_1',
      tool: 'write_file',
      path: 'fresh.md',
      created: true,
      overwrite: false,
      callId: 'call_1',
    }))
  })

  it('maps ApprovalRequested.call_id to prompt.callId and ignores event.id', () => {
    const next = callbacks()
    next.onApprovalRequested = vi.fn()
    expect(applyNativeEvent({
      kind: 'approval_requested',
      prompt_id: 'prompt_2',
      tool: 'bash',
      args: '{"command":"ls"}',
      id: 'not-the-call-id',
      call_id: 'call_2',
    }, next)).toBe(false)
    expect(next.onApprovalRequested).toHaveBeenCalledWith(expect.objectContaining({
      callId: 'call_2',
    }))
  })

  it('leaves callId unset when ApprovalRequested has no call_id', () => {
    const next = callbacks()
    next.onApprovalRequested = vi.fn()
    expect(applyNativeEvent({
      kind: 'approval_requested',
      prompt_id: 'prompt_3',
      tool: 'bash',
      args: '{"command":"ls"}',
      id: 'not-the-call-id',
    }, next)).toBe(false)
    expect(next.onApprovalRequested).toHaveBeenCalledWith(expect.objectContaining({
      callId: undefined,
    }))
  })
})

describe('native stream listen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriState.value = true
  })

  it('keeps the stream open after a non-fatal error so later text still appends', async () => {
    const next = callbacks()
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({ payload: { kind: 'text_delta', text: 'hello' } })
        handler({
          payload: {
            kind: 'error',
            fatal: false,
            message: 'This chat reached its 100 MiB log. Rhizome continued in a new session.',
          },
        })
        handler({ payload: { kind: 'text_delta', text: ' world' } })
        handler({ payload: { kind: 'turn_end' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue('session-1')

    await streamNativeChat({
      target: 'openai/gpt-4o-mini',
      message: 'hi',
      vaultPath: '/vault',
      callbacks: next,
    })

    expect(next.onError).not.toHaveBeenCalled()
    expect(next.onNotice).toHaveBeenCalledWith(
      'This chat reached its 100 MiB log. Rhizome continued in a new session.',
    )
    expect(next.onText).toHaveBeenCalledWith('hello')
    expect(next.onText).toHaveBeenCalledWith(' world')
    expect(next.onDone).toHaveBeenCalledTimes(1)
  })

  it('ends the stream on a fatal error so Send can run again', async () => {
    const next = callbacks()
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({
          payload: {
            kind: 'error',
            fatal: true,
            message: 'No free-tier provider key is set.',
          },
        })
        handler({ payload: { kind: 'text_delta', text: 'later' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue('session-2')

    await streamNativeChat({
      target: 'free_tier_auto',
      message: 'hi',
      vaultPath: '/vault',
      callbacks: next,
    })

    expect(next.onError).toHaveBeenCalledWith(
      `No free-tier provider key is set. ${NATIVE_NO_KEY_GUIDANCE}`,
    )
    expect(next.onDone).toHaveBeenCalledTimes(1)
    expect(next.onText).not.toHaveBeenCalled()
  })

  it('starts a new native session when none is live', async () => {
    const next = callbacks()
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({ payload: { kind: 'turn_end' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue('new-id')

    const sessionId = await streamNativeChat({
      target: 'openai/gpt-4o-mini',
      message: 'hi',
      vaultPath: '/vault',
      callbacks: next,
    })

    expect(sessionId).toBe('new-id')
    expect(invokeMock).toHaveBeenCalledWith('native_chat_start', expect.objectContaining({
      request: expect.objectContaining({ prompt: 'hi' }),
    }))
    expect(invokeMock).not.toHaveBeenCalledWith('native_chat_send', expect.anything())
  })

  it('sends the next turn on the live session so the model sees forked history', async () => {
    const next = callbacks()
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({ payload: { kind: 'turn_end' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue(undefined)

    const sessionId = await streamNativeChat({
      target: 'openai/gpt-4o-mini',
      message: 'what next',
      vaultPath: '/vault',
      sessionId: 'already-open',
      callbacks: next,
    })

    expect(sessionId).toBe('already-open')
    expect(invokeMock).toHaveBeenCalledWith('native_chat_send', {
      sessionId: 'already-open',
      text: 'what next',
    })
    expect(invokeMock).not.toHaveBeenCalledWith('native_chat_start', expect.anything())
  })

  it('passes a reasoning level on start and on the next send', async () => {
    const next = callbacks()
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({ payload: { kind: 'turn_end' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue('new-id')

    await streamNativeChat({
      target: 'xai/grok-4.7',
      message: 'hi',
      vaultPath: '/vault',
      reasoningLevel: 'high',
      callbacks: next,
    })

    expect(invokeMock).toHaveBeenCalledWith('native_chat_start', expect.objectContaining({
      request: expect.objectContaining({ reasoningLevel: 'high' }),
    }))

    invokeMock.mockClear()
    await streamNativeChat({
      target: 'xai/grok-4.7',
      message: 'again',
      vaultPath: '/vault',
      sessionId: 'already-open',
      reasoningLevel: 'low',
      callbacks: callbacks(),
    })

    expect(invokeMock).toHaveBeenCalledWith('native_chat_send', {
      sessionId: 'already-open',
      text: 'again',
      reasoningLevel: 'low',
    })
  })

  it('sends null to clear a reasoning level and omits the key when unset', async () => {
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({ payload: { kind: 'turn_end' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue(undefined)

    await streamNativeChat({
      target: 'xai/grok-4.7',
      message: 'clear it',
      vaultPath: '/vault',
      sessionId: 'already-open',
      reasoningLevel: null,
      callbacks: callbacks(),
    })

    expect(invokeMock).toHaveBeenCalledWith('native_chat_send', {
      sessionId: 'already-open',
      text: 'clear it',
      reasoningLevel: null,
    })
  })

  it('sends composer images on native start and on the next turn', async () => {
    const next = callbacks()
    listenMock.mockImplementation(async (_name: string, handler: (event: { payload: unknown }) => void) => {
      queueMicrotask(() => {
        handler({ payload: { kind: 'turn_end' } })
      })
      return vi.fn()
    })
    invokeMock.mockResolvedValue('new-id')
    const images = [{ type: 'image' as const, data: 'aaaa', mimeType: 'image/png' }]

    await streamNativeChat({
      target: 'openai/gpt-4o',
      message: 'what is this',
      vaultPath: '/vault',
      images,
      callbacks: next,
    })

    expect(invokeMock).toHaveBeenCalledWith('native_chat_start', expect.objectContaining({
      request: expect.objectContaining({
        prompt: 'what is this',
        images,
      }),
    }))

    invokeMock.mockClear()
    await streamNativeChat({
      target: 'openai/gpt-4o',
      message: 'and this',
      vaultPath: '/vault',
      sessionId: 'already-open',
      images,
      callbacks: callbacks(),
    })

    expect(invokeMock).toHaveBeenCalledWith('native_chat_send', {
      sessionId: 'already-open',
      text: 'and this',
      images,
    })
  })
})
