import { describe, it, expect } from 'vitest'
import { isEmoji, ALL_EMOJIS, EMOJIS_BY_GROUP, EMOJI_GROUPS, searchEmojis } from '../emoji'

describe('isEmoji', () => {
  it('returns true for common emoji', () => {
    expect(isEmoji('🎯')).toBe(true)
    expect(isEmoji('🔥')).toBe(true)
    expect(isEmoji('🚀')).toBe(true)
    expect(isEmoji('❤️')).toBe(true)
    expect(isEmoji('✨')).toBe(true)
  })

  it('returns false for Phosphor icon names', () => {
    expect(isEmoji('cooking-pot')).toBe(false)
    expect(isEmoji('file-text')).toBe(false)
    expect(isEmoji('rocket')).toBe(false)
    expect(isEmoji('star')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isEmoji('')).toBe(false)
  })

  it('returns false for regular text', () => {
    expect(isEmoji('hello')).toBe(false)
    expect(isEmoji('ABC')).toBe(false)
    expect(isEmoji('123')).toBe(false)
  })

  it('handles compound emoji (ZWJ sequences)', () => {
    expect(isEmoji('👨‍💻')).toBe(true)
    expect(isEmoji('🧑‍🔬')).toBe(true)
  })

  it('returns false for multi-emoji strings', () => {
    expect(isEmoji('🔥🚀')).toBe(false)
    expect(isEmoji('hi 🎯')).toBe(false)
  })
})

describe('ALL_EMOJIS', () => {
  it('contains the full Unicode emoji set (1800+)', () => {
    expect(ALL_EMOJIS.length).toBeGreaterThan(1800)
  })

  it('each entry has emoji, name, and group', () => {
    for (const entry of ALL_EMOJIS.slice(0, 20)) {
      expect(entry.emoji).toBeTruthy()
      expect(entry.name).toBeTruthy()
      expect(entry.group).toBeTruthy()
    }
  })

  it('includes well-known emojis', () => {
    const emojis = new Set(ALL_EMOJIS.map(e => e.emoji))
    expect(emojis.has('🚀')).toBe(true)
    expect(emojis.has('❤️')).toBe(true)
    expect(emojis.has('🔥')).toBe(true)
    expect(emojis.has('🎯')).toBe(true)
  })
})

describe('EMOJIS_BY_GROUP', () => {
  it('has entries for all groups', () => {
    for (const group of EMOJI_GROUPS) {
      const emojis = EMOJIS_BY_GROUP.get(group)
      expect(emojis).toBeDefined()
      expect(emojis!.length).toBeGreaterThan(0)
    }
  })
})

describe('searchEmojis', () => {
  it('finds rocket emoji by name', () => {
    const results = searchEmojis('rocket')
    expect(results.some(e => e.emoji === '🚀')).toBe(true)
  })

  it('finds heart emojis by name', () => {
    const results = searchEmojis('heart')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(e => e.emoji === '❤️')).toBe(true)
  })

  it('finds fire emoji by name', () => {
    const results = searchEmojis('fire')
    expect(results.some(e => e.emoji === '🔥')).toBe(true)
  })

  it('supports multi-word search', () => {
    const results = searchEmojis('grinning face')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(e => e.name.toLowerCase().includes('grinning') && e.name.toLowerCase().includes('face'))).toBe(true)
  })

  it('returns all emojis for empty query', () => {
    expect(searchEmojis('')).toBe(ALL_EMOJIS)
    expect(searchEmojis('  ')).toBe(ALL_EMOJIS)
  })

  it('returns empty array for nonsense query', () => {
    expect(searchEmojis('xyzzyplugh')).toHaveLength(0)
  })
})
