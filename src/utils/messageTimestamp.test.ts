import { describe, expect, it } from 'vitest'
import { formatMessageClock, normalizeMessageTimestampMs } from './messageTimestamp'

describe('messageTimestamp', () => {
  it('formats a local clock like session names (3:35p)', () => {
    // Fixed instant: 2026-09-06 15:35:00 local — construct via Date parts so
    // the assertion is timezone-stable on the machine under test.
    const ms = new Date(2026, 8, 6, 15, 35, 0).getTime()
    expect(formatMessageClock(ms)).toBe('3:35p')
  })

  it('uses 12 for noon and midnight', () => {
    expect(formatMessageClock(new Date(2026, 8, 6, 0, 5, 0).getTime())).toBe('12:05a')
    expect(formatMessageClock(new Date(2026, 8, 6, 12, 0, 0).getTime())).toBe('12:00p')
  })

  it('accepts unix seconds from older logs', () => {
    const seconds = Math.floor(new Date(2026, 8, 6, 9, 1, 0).getTime() / 1000)
    expect(normalizeMessageTimestampMs(seconds)).toBe(seconds * 1000)
    expect(formatMessageClock(seconds)).toBe('9:01a')
  })
})
