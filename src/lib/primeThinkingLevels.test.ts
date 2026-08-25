import { describe, expect, it } from 'vitest'
import { modelThinkingLabel, nextThinkingToggleLevel, thinkingLevelLabel } from './primeThinkingLevels'

describe('thinkingLevelLabel', () => {
  it('renders each level Prime documents', () => {
    // The ids come from the host (PRIME_THINKING_LEVELS); this only asserts how
    // they render, which is the part that lives in the frontend.
    expect(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].map(thinkingLevelLabel))
      .toEqual(['Off', 'Minimal', 'Low', 'Medium', 'High', 'X-High', 'Max'])
  })

  it('spells xhigh so it does not read as a typo', () => {
    expect(thinkingLevelLabel('xhigh')).toBe('X-High')
    expect(thinkingLevelLabel('xhigh')).not.toBe('Xhigh')
  })

  it('capitalises an unrecognised level rather than dropping it', () => {
    // A level Prime adds later should render imperfectly, not disappear from
    // the control and leave the user unable to see what they are running at.
    expect(thinkingLevelLabel('ultra')).toBe('Ultra')
  })

  it('is case- and whitespace-insensitive about what the daemon sent', () => {
    expect(thinkingLevelLabel('  HIGH ')).toBe('High')
  })

  it('has nothing to say about an absent level', () => {
    expect(thinkingLevelLabel(null)).toBeNull()
    expect(thinkingLevelLabel(undefined)).toBeNull()
    expect(thinkingLevelLabel('   ')).toBeNull()
  })
})

describe('modelThinkingLabel', () => {
  it('joins model and level the way #9 specifies', () => {
    expect(modelThinkingLabel('Grok 4.5', 'high')).toBe('Grok 4.5 · High')
  })

  it('shows the model alone when no level has been reported', () => {
    // Not "Grok 4.5 · " — a dangling separator reads as a rendering bug.
    expect(modelThinkingLabel('Grok 4.5', null)).toBe('Grok 4.5')
    expect(modelThinkingLabel('Grok 4.5', '')).toBe('Grok 4.5')
  })

  it('shows off as a real setting, not as absence', () => {
    // "off" is a choice the user made and can change; it must not look the
    // same as a session that has not reported a level yet.
    expect(modelThinkingLabel('Grok 4.5', 'off')).toBe('Grok 4.5 · Off')
  })

  it('renders nothing at all without a model', () => {
    expect(modelThinkingLabel(null, 'high')).toBeNull()
    expect(modelThinkingLabel('  ', 'high')).toBeNull()
  })
})

describe('nextThinkingToggleLevel', () => {
  const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

  it('turns a quiet or middle setting up to high', () => {
    expect(nextThinkingToggleLevel('off', levels)).toBe('high')
    expect(nextThinkingToggleLevel('low', levels)).toBe('high')
    expect(nextThinkingToggleLevel('medium', levels)).toBe('high')
    expect(nextThinkingToggleLevel(null, levels)).toBe('high')
  })

  it('turns a loud setting back to off', () => {
    expect(nextThinkingToggleLevel('high', levels)).toBe('off')
    expect(nextThinkingToggleLevel('xhigh', levels)).toBe('off')
    expect(nextThinkingToggleLevel('max', levels)).toBe('off')
  })

  it('picks endpoints that actually exist on the host list', () => {
    expect(nextThinkingToggleLevel('medium', ['low', 'medium', 'xhigh'])).toBe('xhigh')
    expect(nextThinkingToggleLevel('xhigh', ['low', 'medium', 'xhigh'])).toBe('low')
  })

  it('has nowhere to go when the host sent no levels', () => {
    expect(nextThinkingToggleLevel('high', [])).toBeNull()
  })
})
