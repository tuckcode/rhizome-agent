import { describe, expect, it } from 'vitest'
import {
  forksPrimeEntry,
  nativeChatListItemToSummary,
  nativeChatListToSummaries,
  nativeEventsToConversation,
  isNativeSessionPath,
  nativeSessionPath,
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

  it('copies the whole transcript when the id is missing', () => {
    expect(transcriptUntilMessage(messages, 'missing')).toHaveLength(3)
  })
})

describe('isNativeSessionPath', () => {
  it('accepts only the Rhizome native prefix', () => {
    expect(isNativeSessionPath(nativeSessionPath('n1'))).toBe(true)
    expect(isNativeSessionPath('/sessions/prime.jsonl')).toBe(false)
    expect(isNativeSessionPath(null)).toBe(false)
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
})
