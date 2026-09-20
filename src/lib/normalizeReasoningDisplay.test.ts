import { describe, expect, it } from 'vitest'
import { normalizeReasoningDisplay } from './normalizeReasoningDisplay'

const HISTORY_OPEN = ['<', 'conversation_history', '>'].join('')
const HISTORY_CLOSE = ['</', 'conversation_history', '>'].join('')

describe('normalizeReasoningDisplay', () => {
  it('inserts a space after a glued sentence join', () => {
    expect(normalizeReasoningDisplay('The path is blocked.Next I will try another route.')).toBe(
      'The path is blocked. Next I will try another route.',
    )
  })

  it('does not double-space a sentence that already has a gap', () => {
    expect(normalizeReasoningDisplay('Done. Next I will write the reply.')).toBe(
      'Done. Next I will write the reply.',
    )
  })

  it('preserves real newlines instead of flattening them', () => {
    const source = 'First line\nSecond line'
    const display = normalizeReasoningDisplay(source)
    expect(display).toContain('\n')
    expect(display).not.toBe('First line Second line')
    expect(display.startsWith('First line')).toBe(true)
    expect(display.endsWith('Second line')).toBe(true)
  })

  it('leaves an existing blank line as a paragraph break', () => {
    expect(normalizeReasoningDisplay('Alpha\n\nBeta')).toBe('Alpha\n\nBeta')
  })

  it('does not treat a lowercase file suffix as a glued sentence', () => {
    expect(normalizeReasoningDisplay('See notes.md for the plan.')).toBe(
      'See notes.md for the plan.',
    )
  })

  it('strips echoed conversation_history blocks from the reasoning fold', () => {
    const dumped = [
      HISTORY_OPEN,
      '[user]: first turn',
      '',
      '[user]: latest turn',
      HISTORY_CLOSE,
      '',
      'I will answer the latest turn.',
    ].join('\n')
    expect(normalizeReasoningDisplay(dumped)).toBe('I will answer the latest turn.')
  })

  it('collapses to empty when reasoning is only a history dump', () => {
    const dumped = `${HISTORY_OPEN}\n[user]: only history\n${HISTORY_CLOSE}`
    expect(normalizeReasoningDisplay(dumped).trim()).toBe('')
  })
})
