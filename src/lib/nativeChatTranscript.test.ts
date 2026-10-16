import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callHostMock } = vi.hoisted(() => ({
  callHostMock: vi.fn(),
}))

vi.mock('./callHost', () => ({
  callHost: (...args: unknown[]) => callHostMock(...args),
}))

import {
  conversationToNativeEvents,
  currentNativeSession,
  forksPrimeEntry,
  nativeChatListItemToSummary,
  nativeChatListToSummaries,
  nativeEventsToConversation,
  isNativeSessionPath,
  nativeSessionIdFromPath,
  nativeSessionPath,
  persistNativeFork,
  rememberNativeSession,
  transcriptUntilMessage,
} from './nativeChatTranscript'
import type { AiAgentMessage } from './aiAgentConversation'

function turn(id: string, userMessage: string, response: string): AiAgentMessage {
  return { id, userMessage, response, actions: [] }
}

describe('forksPrimeEntry', () => {
  it('is only true for Prime chats that asked to fork a Prime entry', () => {
    expect(forksPrimeEntry(true, true)).toBe(true)
    expect(forksPrimeEntry(true, false)).toBe(false)
    expect(forksPrimeEntry(false, true)).toBe(false)
    expect(forksPrimeEntry(false)).toBe(false)
  })
})

describe('transcriptUntilMessage', () => {
  const messages = [
    turn('m1', 'First', 'One'),
    turn('m2', 'Second', 'Two'),
    turn('m3', 'Third', 'Three'),
  ]

  it('keeps the chosen turn and everything before it', () => {
    expect(transcriptUntilMessage(messages, 'm2')).toEqual([
      expect.objectContaining({ id: 'm1', userMessage: 'First' }),
      expect.objectContaining({ id: 'm2', userMessage: 'Second' }),
    ])
  })

  it('clears streaming flags so the fork is history', () => {
    const live = [{ ...turn('m1', 'Hi', 'There'), isStreaming: true }]
    expect(transcriptUntilMessage(live, 'm1')[0]?.isStreaming).toBe(false)
  })

  it('fails when the message id is missing', () => {
    expect(() => transcriptUntilMessage(messages, 'missing')).toThrow(
      'Unknown native chat message id: missing',
    )
  })
})

describe('isNativeSessionPath', () => {
  it('accepts only the Rhizome native prefix', () => {
    expect(isNativeSessionPath(nativeSessionPath('n1'))).toBe(true)
    expect(isNativeSessionPath('/sessions/prime.jsonl')).toBe(false)
    expect(isNativeSessionPath(null)).toBe(false)
    expect(nativeSessionIdFromPath(nativeSessionPath('n1'))).toBe('n1')
    expect(nativeSessionIdFromPath('/sessions/prime.jsonl')).toBeNull()
  })
})

describe('nativeChatListItemToSummary', () => {
  it('files native rows under the Rhizome prefix, not Prime paths', () => {
    const summary = nativeChatListItemToSummary({
      sessionId: 'n1',
      createdAt: '2026-10-13T12:00:00.000Z',
      target: 'free_tier_auto',
      title: 'Hello',
      archived: true,
    })
    expect(summary).toEqual(expect.objectContaining({
      id: 'n1',
      path: nativeSessionPath('n1'),
      title: 'Hello',
      archived: true,
    }))
    expect(summary.path).toContain('rhizome-native:')
    expect(summary.path).not.toContain('.prime')
  })

  it('ignores values that are not native list rows', () => {
    expect(nativeChatListToSummaries([{ id: 'prime-shaped' }])).toEqual([])
    expect(nativeChatListToSummaries(null)).toEqual([])
  })
})

describe('nativeEventsToConversation', () => {
  it('folds a user and assistant pair into one turn', () => {
    const messages = nativeEventsToConversation([
      { User: { text: 'Hello' } },
      { Assistant: { text: 'Hi there' } },
      'TurnEnd',
    ])
    expect(messages).toEqual([
      expect.objectContaining({ userMessage: 'Hello', response: 'Hi there' }),
    ])
  })

  it('does not mark a tool call completed until a result arrives', () => {
    const messages = nativeEventsToConversation([
      { User: { text: 'Search' } },
      { ToolCall: { id: 't1', name: 'search', args: '{}' } },
      'TurnEnd',
    ])
    expect(messages[0]?.actions).toEqual([
      expect.objectContaining({ toolId: 't1', status: 'pending' }),
    ])
  })

  it('marks a tool done only once the result is present', () => {
    const messages = nativeEventsToConversation([
      { User: { text: 'Search' } },
      { ToolCall: { id: 't1', name: 'search', args: '{}' } },
      { ToolResult: { id: 't1', name: 'search', output: 'found' } },
      'TurnEnd',
    ])
    expect(messages[0]?.actions).toEqual([
      expect.objectContaining({ toolId: 't1', status: 'done', output: 'found' }),
    ])
  })
})

describe('conversationToNativeEvents', () => {
  it('round-trips kept turns so a reload can restore them', () => {
    const kept = transcriptUntilMessage([
      turn('m1', 'First', 'One'),
      turn('m2', 'Second', 'Two'),
      turn('m3', 'Third', 'Three'),
    ], 'm2')
    expect(nativeEventsToConversation(conversationToNativeEvents(kept))).toEqual([
      expect.objectContaining({ userMessage: 'First', response: 'One' }),
      expect.objectContaining({ userMessage: 'Second', response: 'Two' }),
    ])
  })
})

describe('persistNativeFork', () => {
  beforeEach(() => {
    callHostMock.mockReset()
    callHostMock.mockResolvedValue('fork-id')
    rememberNativeSession(null)
  })

  it('writes the kept turns as a new native session', async () => {
    const sessionId = await persistNativeFork({
      messages: [
        turn('m1', 'First', 'One'),
        turn('m2', 'Second', 'Two'),
        turn('m3', 'Third', 'Three'),
      ],
      messageId: 'm2',
      target: 'openai/gpt-4o-mini',
      vaultPath: '/vault',
    })
    expect(sessionId).toBe('fork-id')
    expect(callHostMock).toHaveBeenCalledWith('native_chat_fork', {
      request: {
        events: conversationToNativeEvents([
          turn('m1', 'First', 'One'),
          turn('m2', 'Second', 'Two'),
        ]),
        target: 'openai/gpt-4o-mini',
        systemPrompt: null,
        vaultPath: '/vault',
        vaultPaths: [],
        permissionMode: 'safe',
      },
    })
  })

  it('still persists a fork when the source chat is archived', async () => {
    await persistNativeFork({
      messages: [turn('m1', 'Filed', 'Ok')],
      messageId: 'm1',
      target: 'free_tier_auto',
    })
    expect(callHostMock).toHaveBeenCalledWith(
      'native_chat_fork',
      expect.objectContaining({
        request: expect.not.objectContaining({ archived: true }),
      }),
    )
  })

  it('does not call the host when the message id is unknown', async () => {
    await expect(persistNativeFork({
      messages: [turn('m1', 'First', 'One')],
      messageId: 'missing',
      target: 'free_tier_auto',
    })).rejects.toThrow('Unknown native chat message id: missing')
    expect(callHostMock).not.toHaveBeenCalled()
  })
})

describe('rememberNativeSession', () => {
  it('holds the live native session until New chat clears it', () => {
    rememberNativeSession('n1', true)
    expect(currentNativeSession()).toEqual({ sessionId: 'n1', readOnly: true })
    rememberNativeSession(null)
    expect(currentNativeSession()).toEqual({ sessionId: null, readOnly: false })
  })
})
