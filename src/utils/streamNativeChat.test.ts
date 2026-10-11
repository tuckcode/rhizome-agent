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
      message: 'flush native session line: disk error',
    }, next)).toBe(false)
    expect(next.onError).not.toHaveBeenCalled()
    expect(next.onNotice).toHaveBeenCalledWith('flush native session line: disk error')
    expect(applyNativeEvent({ kind: 'text_delta', text: 'later' }, next)).toBe(false)
    expect(next.onText).toHaveBeenCalledWith('later')
  })

  it('does not end the stream on a text delta', () => {
    const next = callbacks()
    expect(applyNativeEvent({ kind: 'text_delta', text: 'hi' }, next)).toBe(false)
    expect(next.onText).toHaveBeenCalledWith('hi')
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
})
