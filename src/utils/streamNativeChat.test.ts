import { describe, expect, it, vi } from 'vitest'
import type { AgentStreamCallbacks } from './streamAiAgent'
import {
  NATIVE_NO_KEY_GUIDANCE,
  applyNativeEvent,
  nativeChatUserError,
} from './streamNativeChat'

function callbacks(): AgentStreamCallbacks {
  return {
    onText: vi.fn(),
    onThinking: vi.fn(),
    onToolStart: vi.fn(),
    onToolDone: vi.fn(),
    onError: vi.fn(),
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
  it('rewrites an error event and ends the stream so the composer can send again', () => {
    const next = callbacks()
    const ended = applyNativeEvent({
      kind: 'error',
      message: 'Prime Agent is not available on this machine. Install it with `npm i -g prime-agent`.',
    }, next)
    expect(ended).toBe(true)
    expect(next.onError).toHaveBeenCalledWith(
      `This native chat needs an API key. ${NATIVE_NO_KEY_GUIDANCE}`,
    )
    expect(next.onDone).not.toHaveBeenCalled()
  })

  it('does not end the stream on a text delta', () => {
    const next = callbacks()
    expect(applyNativeEvent({ kind: 'text_delta', text: 'hi' }, next)).toBe(false)
    expect(next.onText).toHaveBeenCalledWith('hi')
  })
})
