import { describe, expect, it } from 'vitest'
import { aiPanelFrameStyle } from './aiPanelPulse'

/**
 * The frame border once pulsed for the whole length of a turn. The run
 * status line replaced that signal (ADR-0193), so the border holds still.
 */
describe('aiPanelFrameStyle', () => {
  it('marks a running turn with a 2px border in the brand color', () => {
    const style = aiPanelFrameStyle(true, true)

    expect(style.borderLeft).toBe('2px solid var(--primary)')
  })

  it('does not animate while a turn runs', () => {
    const style = aiPanelFrameStyle(true, true)

    expect(style.animation).toBeUndefined()
    expect(style.transition).toBeUndefined()
  })

  it('keeps a 1px border when idle and none when the border is off', () => {
    expect(aiPanelFrameStyle(false, true).borderLeft).toBe('1px solid var(--border)')
    expect(aiPanelFrameStyle(true, false).borderLeft).toBeUndefined()
  })
})
