import { describe, expect, it } from 'vitest'
import { buildGoalCommandText, parseGoalBudgetInput } from './primeGoalCommand'

describe('buildGoalCommandText', () => {
  /**
   * Prime's own `/goal` parser reads `--budget` as the first token of the
   * rest of the line, then treats everything after it as the objective — so
   * the budget flag has to come before the objective text, not after.
   */
  it('puts --budget before the objective when a budget is given', () => {
    expect(buildGoalCommandText('ship the release notes', 5000)).toBe(
      '/goal --budget 5000 ship the release notes',
    )
  })

  it('omits --budget entirely when no budget is given', () => {
    expect(buildGoalCommandText('ship the release notes', null)).toBe(
      '/goal ship the release notes',
    )
  })

  it('trims surrounding whitespace from the objective', () => {
    expect(buildGoalCommandText('  ship it  ', null)).toBe('/goal ship it')
  })
})

describe('parseGoalBudgetInput', () => {
  it('returns null for an empty string — no budget requested', () => {
    expect(parseGoalBudgetInput('')).toBe(null)
    expect(parseGoalBudgetInput('   ')).toBe(null)
  })

  it('parses a positive integer', () => {
    expect(parseGoalBudgetInput('5000')).toBe(5000)
  })

  it('rejects zero, negative, decimal and non-numeric input', () => {
    expect(parseGoalBudgetInput('0')).toBe('invalid')
    expect(parseGoalBudgetInput('-5')).toBe('invalid')
    expect(parseGoalBudgetInput('1.5')).toBe('invalid')
    expect(parseGoalBudgetInput('abc')).toBe('invalid')
  })
})
