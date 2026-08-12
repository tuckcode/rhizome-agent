import { describe, expect, it } from 'vitest'
import {
  contextPercent,
  contextPressure,
  formatContextUsage,
  formatTokenCount,
} from './usePrimeSessionStats'

describe('usePrimeSessionStats formatters', () => {
  it('formats token counts compactly', () => {
    expect(formatTokenCount(669_500)).toBe('669.5k')
    expect(formatTokenCount(1_000_000)).toBe('1.0M')
    expect(formatTokenCount(420)).toBe('420')
  })

  /** Unknown must stay unknown — a fresh Prime session reports no tokens, and
   *  rendering that as "0" would claim a fact we do not have. */
  it('returns null for unknown or nonsensical counts rather than zero', () => {
    expect(formatTokenCount(undefined)).toBeNull()
    expect(formatTokenCount(null)).toBeNull()
    expect(formatTokenCount(-1)).toBeNull()
    expect(formatTokenCount(Number.NaN)).toBeNull()
  })

  it('renders usage only when both the figure and the window are known', () => {
    expect(formatContextUsage({ contextTokens: 60_000, contextWindow: 200_000, contextPercent: 30 }))
      .toBe('60.0k / 200.0k (30%)')
    // percent missing but derivable
    expect(formatContextUsage({ contextTokens: 50_000, contextWindow: 200_000 }))
      .toBe('50.0k / 200.0k (25%)')
    // no denominator -> say nothing
    expect(formatContextUsage({ contextTokens: 60_000 })).toBeNull()
    expect(formatContextUsage({})).toBeNull()
  })

  it('prefers Prime\'s reported percent but falls back to computing it', () => {
    expect(contextPercent({ contextPercent: 67 })).toBe(67)
    expect(contextPercent({ contextTokens: 25_000, contextWindow: 100_000 })).toBe(25)
    expect(contextPercent({})).toBeNull()
  })

  it('clamps a percent that would otherwise overflow the bar', () => {
    expect(contextPercent({ contextPercent: 140 })).toBe(100)
    expect(contextPercent({ contextPercent: -5 })).toBe(0)
    expect(contextPercent({ contextTokens: 300, contextWindow: 100 })).toBe(100)
  })

  it('escalates pressure so a nearly-full window reads as urgent', () => {
    expect(contextPressure(30)).toBe('ok')
    expect(contextPressure(75)).toBe('warn')
    expect(contextPressure(90)).toBe('high')
    expect(contextPressure(null)).toBeNull()
  })
})
