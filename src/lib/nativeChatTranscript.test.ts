import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callHostMock } = vi.hoisted(() => ({
  callHostMock: vi.fn(),
}))

vi.mock('./callHost', () => ({
  callHost: (...args: unknown[]) => callHostMock(...args),
}))

import {
  CANCELLED_NATIVE_TOOL_REASON,
  conversationToNativeEvents,
  createNativeLiveSlot,
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
  resetNativeLiveSessions,
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

  it('keeps assistant text when a ModelFailed follows it', () => {
    const messages = nativeEventsToConversation([
      { User: { text: 'Hello' } },
      { Assistant: { text: 'I found it' } },
      { ModelFailed: { message: 'provider down' } },
      'TurnEnd',
    ])
    expect(messages).toEqual([
      expect.objectContaining({
        userMessage: 'Hello',
        response: 'I found it\n\nError: provider down',
      }),
    ])
  })

  it('marks a matching ToolDenied as an error on the existing call', () => {
    const messages = nativeEventsToConversation([
      { User: { text: 'Search' } },
      { ToolCall: { id: 't1', name: 'search', args: '{}' } },
      { ToolDenied: { id: 't1', name: 'search', reason: 'cancelled' } },
      'TurnEnd',
    ])
    expect(messages[0]?.actions).toEqual([
      expect.objectContaining({ toolId: 't1', status: 'error', output: 'cancelled' }),
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

  it('keeps assistant text that came between tool rounds in front of the next call', () => {
    const events = conversationToNativeEvents([{
      id: 'm1',
      userMessage: 'Do both',
      response: 'Here is the answer',
      actions: [
        {
          tool: 'search',
          toolId: 't1',
          label: 'search',
          status: 'done',
          input: '{}',
          output: 'hits',
          beforeText: 'I will search first',
        },
        {
          tool: 'write',
          toolId: 't2',
          label: 'write',
          status: 'error',
          input: '{}',
          output: 'disk full',
          beforeText: 'Now I will write',
        },
      ],
    }])
    expect(events).toEqual([
      { User: { text: 'Do both' } },
      { Assistant: { text: 'I will search first' } },
      { ToolCall: { id: 't1', name: 'search', args: '{}' } },
      { ToolResult: { id: 't1', name: 'search', output: 'hits' } },
      { Assistant: { text: 'Now I will write' } },
      { ToolCall: { id: 't2', name: 'write', args: '{}' } },
      { ToolDenied: { id: 't2', name: 'write', reason: 'disk full' } },
      { Assistant: { text: 'Here is the answer' } },
      'TurnEnd',
    ])
    expect(nativeEventsToConversation(events)[0]).toEqual(expect.objectContaining({
      userMessage: 'Do both',
      response: 'Here is the answer',
      actions: [
        expect.objectContaining({ toolId: 't1', beforeText: 'I will search first', status: 'done' }),
        expect.objectContaining({ toolId: 't2', beforeText: 'Now I will write', status: 'error' }),
      ],
    }))
  })

  it('writes each tool call next to a result, then the final assistant text', () => {
    const events = conversationToNativeEvents([{
      id: 'm1',
      userMessage: 'Do both',
      response: 'Tried both',
      actions: [
        { tool: 'search', toolId: 'pending-1', label: 'search', status: 'pending', input: '{}' },
        { tool: 'write', toolId: 'err-1', label: 'write', status: 'error', input: '{}', output: 'disk full' },
        { tool: 'echo', toolId: 'ok-1', label: 'echo', status: 'done', input: 'ping', output: 'pong' },
      ],
    }])
    expect(events).toEqual([
      { User: { text: 'Do both' } },
      { ToolCall: { id: 'pending-1', name: 'search', args: '{}' } },
      { ToolDenied: { id: 'pending-1', name: 'search', reason: CANCELLED_NATIVE_TOOL_REASON } },
      { ToolCall: { id: 'err-1', name: 'write', args: '{}' } },
      { ToolDenied: { id: 'err-1', name: 'write', reason: 'disk full' } },
      { ToolCall: { id: 'ok-1', name: 'echo', args: 'ping' } },
      { ToolResult: { id: 'ok-1', name: 'echo', output: 'pong' } },
      { Assistant: { text: 'Tried both' } },
      'TurnEnd',
    ])
    const reloaded = nativeEventsToConversation(events)
    expect(reloaded[0]?.actions).toEqual([
      expect.objectContaining({ toolId: 'pending-1', status: 'error', output: CANCELLED_NATIVE_TOOL_REASON }),
      expect.objectContaining({ toolId: 'err-1', status: 'error', output: 'disk full' }),
      expect.objectContaining({ toolId: 'ok-1', status: 'done', output: 'pong' }),
    ])
    expect(reloaded[0]?.response).toBe('Tried both')
  })
})

describe('persistNativeFork', () => {
  beforeEach(() => {
    callHostMock.mockReset()
    callHostMock.mockResolvedValue('fork-id')
    resetNativeLiveSessions()
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

  it('persists pending and errored tools as paired call/result events', async () => {
    const forked: AiAgentMessage = {
      id: 'm1',
      userMessage: 'Do both',
      response: 'Tried both',
      actions: [
        { tool: 'search', toolId: 'pending-1', label: 'search', status: 'pending', input: '{}' },
        { tool: 'write', toolId: 'err-1', label: 'write', status: 'error', input: '{}', output: 'disk full' },
      ],
    }
    await persistNativeFork({
      messages: [forked],
      messageId: 'm1',
      target: 'openai/gpt-4o-mini',
    })
    expect(callHostMock).toHaveBeenCalledWith(
      'native_chat_fork',
      expect.objectContaining({
        request: expect.objectContaining({
          events: conversationToNativeEvents([forked]),
        }),
      }),
    )
    const events = conversationToNativeEvents([forked])
    const callIds = events.flatMap((event) => (
      typeof event === 'object' && 'ToolCall' in event ? [event.ToolCall.id] : []
    ))
    const resultIds = events.flatMap((event) => {
      if (typeof event !== 'object') return []
      if ('ToolResult' in event) return [event.ToolResult.id]
      if ('ToolDenied' in event) return [event.ToolDenied.id]
      return []
    })
    expect(callIds.sort()).toEqual(resultIds.sort())
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
  beforeEach(() => {
    resetNativeLiveSessions()
  })

  it('holds the live native session on one slot until that slot is cleared', () => {
    rememberNativeSession('panel:1', 'n1', true)
    expect(currentNativeSession('panel:1')).toEqual({ sessionId: 'n1', readOnly: true })
    rememberNativeSession('panel:1', null)
    expect(currentNativeSession('panel:1')).toEqual({ sessionId: null, readOnly: false })
  })

  it('does not share a live session across two panel slots', () => {
    const first = createNativeLiveSlot()
    const second = createNativeLiveSlot()
    rememberNativeSession(first, 'n1')
    rememberNativeSession(second, 'n2', true)
    expect(first).not.toBe(second)
    expect(currentNativeSession(first)).toEqual({ sessionId: 'n1', readOnly: false })
    expect(currentNativeSession(second)).toEqual({ sessionId: 'n2', readOnly: true })
  })

  it('shares a slot when two surfaces use the same workspace session id', () => {
    expect(createNativeLiveSlot('chat-1')).toBe(createNativeLiveSlot('chat-1'))
  })
})
