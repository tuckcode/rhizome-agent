import { describe, expect, it } from 'vitest'
import {
  CELEBRATION_COOLDOWN_MS,
  type CelebrationGateState,
  celebrationsEnabledDefault,
  decideCelebration,
  readCelebrationsEnabled,
} from './celebration'

const IDLE: CelebrationGateState = { lastCelebratedAt: 0, lastReason: null }

function ask(overrides: Partial<Parameters<typeof decideCelebration>[0]> = {}) {
  return decideCelebration({
    state: IDLE,
    reason: 'goal-completed',
    now: 10_000,
    enabled: true,
    reducedMotion: false,
    ...overrides,
  })
}

describe('deciding whether to celebrate', () => {
  it('celebrates when nothing is in the way', () => {
    const decision = ask()
    expect(decision.celebrate).toBe(true)
    expect(decision.state.lastCelebratedAt).toBe(10_000)
    expect(decision.state.lastReason).toBe('goal-completed')
  })

  it('refuses when the user has turned celebrations off', () => {
    expect(ask({ enabled: false }).celebrate).toBe(false)
  })

  it('refuses when the system asks for reduced motion', () => {
    expect(ask({ reducedMotion: true }).celebrate).toBe(false)
  })

  /**
   * The whole reason the gate exists. Two sources can notice the same
   * milestone — Prime calls `show_confetti` for landing the work, and the
   * goal-completed event fires a second later. One burst, not two.
   */
  it('swallows a second celebration inside the cooldown', () => {
    const first = ask()
    const second = decideCelebration({
      state: first.state,
      reason: 'agent',
      now: 10_000 + CELEBRATION_COOLDOWN_MS - 1,
      enabled: true,
      reducedMotion: false,
    })

    expect(second.celebrate).toBe(false)
    // The refused attempt must not extend the window, or a chatty source
    // could hold the gate shut forever.
    expect(second.state.lastCelebratedAt).toBe(10_000)
  })

  it('opens again once the cooldown has passed', () => {
    const first = ask()
    const later = decideCelebration({
      state: first.state,
      reason: 'agent',
      now: 10_000 + CELEBRATION_COOLDOWN_MS,
      enabled: true,
      reducedMotion: false,
    })

    expect(later.celebrate).toBe(true)
  })

  /**
   * A refusal is not a silent failure — the caller may want to know it was
   * suppressed rather than never asked, if only for analytics.
   */
  it('names why it refused', () => {
    expect(ask({ enabled: false }).refusal).toBe('disabled')
    expect(ask({ reducedMotion: true }).refusal).toBe('reduced-motion')
    const first = ask()
    expect(
      decideCelebration({
        state: first.state,
        reason: 'agent',
        now: 10_100,
        enabled: true,
        reducedMotion: false,
      }).refusal,
    ).toBe('cooldown')
    expect(ask().refusal).toBeUndefined()
  })
})

describe('the stored preference', () => {
  it('is on unless the machine says otherwise', () => {
    expect(celebrationsEnabledDefault).toBe(true)
    expect(readCelebrationsEnabled(null)).toBe(true)
    expect(readCelebrationsEnabled(undefined)).toBe(true)
    expect(readCelebrationsEnabled(true)).toBe(true)
    expect(readCelebrationsEnabled(false)).toBe(false)
  })
})
