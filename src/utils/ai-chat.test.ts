import { describe, it, expect } from 'vitest'

import {
  estimateTokens,
  nextMessageId,
  trimHistory, formatMessageWithHistory,
  type ChatMessage, MAX_HISTORY_TOKENS,
} from './ai-chat'

// --- estimateTokens ---

describe('estimateTokens', () => {
  it('estimates tokens from string length', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  it('accepts a number (char count)', () => {
    expect(estimateTokens(100)).toBe(25)
  })
})

// --- nextMessageId ---

describe('nextMessageId', () => {
  it('returns unique IDs', () => {
    const id1 = nextMessageId()
    const id2 = nextMessageId()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^msg-/)
  })
})

// --- trimHistory ---

describe('trimHistory', () => {
  const msg = (role: 'user' | 'assistant', content: string): ChatMessage => ({
    role, content, id: `msg-${content}`,
  })

  it('returns empty array for empty history', () => {
    expect(trimHistory([], 1000)).toEqual([])
  })

  it('returns all messages when under token limit', () => {
    const history = [msg('user', 'hi'), msg('assistant', 'hello')]
    expect(trimHistory(history, 1000)).toEqual(history)
  })

  it('drops oldest messages when over token limit', () => {
    const history = [
      msg('user', 'a'.repeat(400)),      // 100 tokens
      msg('assistant', 'b'.repeat(400)),  // 100 tokens
      msg('user', 'c'.repeat(400)),       // 100 tokens
    ]
    const result = trimHistory(history, 200)
    // Should keep the two most recent messages (200 tokens)
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('b'.repeat(400))
    expect(result[1].content).toBe('c'.repeat(400))
  })

  it('keeps at least one message if it fits', () => {
    const history = [
      msg('user', 'a'.repeat(2000)),  // 500 tokens
      msg('assistant', 'b'.repeat(80)), // 20 tokens
    ]
    const result = trimHistory(history, 30)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('b'.repeat(80))
  })

  it('returns empty when single message exceeds limit', () => {
    const history = [msg('user', 'a'.repeat(4000))] // 1000 tokens
    expect(trimHistory(history, 10)).toEqual([])
  })
})

// --- formatMessageWithHistory ---

describe('formatMessageWithHistory', () => {
  const msg = (role: 'user' | 'assistant', content: string): ChatMessage => ({
    role, content, id: `msg-${content}`,
  })

  it('returns bare message when no history', () => {
    expect(formatMessageWithHistory([], 'hello')).toBe('hello')
  })

  it('includes conversation history before the new message', () => {
    const history = [msg('user', 'What is Rust?'), msg('assistant', 'A systems language.')]
    const result = formatMessageWithHistory(history, 'How does it compare to Go?')
    expect(result).toContain('What is Rust?')
    expect(result).toContain('A systems language.')
    expect(result).toContain('How does it compare to Go?')
  })

  it('labels user and assistant messages correctly', () => {
    const history = [msg('user', 'Q1'), msg('assistant', 'A1')]
    const result = formatMessageWithHistory(history, 'Q2')
    expect(result).toContain('[user]: Q1')
    expect(result).toContain('[assistant]: A1')
    expect(result).toContain('[user]: Q2')
  })

  it('preserves message order', () => {
    const history = [
      msg('user', 'first'),
      msg('assistant', 'second'),
      msg('user', 'third'),
      msg('assistant', 'fourth'),
    ]
    const result = formatMessageWithHistory(history, 'fifth')
    const firstIdx = result.indexOf('first')
    const secondIdx = result.indexOf('second')
    const thirdIdx = result.indexOf('third')
    const fourthIdx = result.indexOf('fourth')
    const fifthIdx = result.indexOf('fifth')
    expect(firstIdx).toBeLessThan(secondIdx)
    expect(secondIdx).toBeLessThan(thirdIdx)
    expect(thirdIdx).toBeLessThan(fourthIdx)
    expect(fourthIdx).toBeLessThan(fifthIdx)
  })
})

// --- MAX_HISTORY_TOKENS ---

describe('MAX_HISTORY_TOKENS', () => {
  it('is a reasonable token limit', () => {
    expect(MAX_HISTORY_TOKENS).toBeGreaterThan(10_000)
    expect(MAX_HISTORY_TOKENS).toBeLessThan(200_000)
  })
})
