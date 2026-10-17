import { describe, expect, it } from 'vitest'
import { commandHasHiddenChars, visibleCommandParts } from './visibleCommand'

describe('visibleCommandParts', () => {
  it('marks real newlines and leaves wrapping text as text', () => {
    expect(visibleCommandParts('rg TODO\nwiki/')).toEqual([
      { kind: 'text', text: 'rg TODO' },
      { kind: 'newline' },
      { kind: 'text', text: 'wiki/' },
    ])
    expect(commandHasHiddenChars('rg TODO\nwiki/')).toBe(false)
  })

  it('shows C0, ESC, zero-width, and bidi characters as hex badges', () => {
    const command = `echo hi\u001b[31m\u200B\u202E`
    const parts = visibleCommandParts(command)
    expect(parts).toEqual([
      { kind: 'text', text: 'echo hi' },
      { kind: 'hidden', hex: '001B' },
      { kind: 'text', text: '[31m' },
      { kind: 'hidden', hex: '200B' },
      { kind: 'hidden', hex: '202E' },
    ])
    expect(commandHasHiddenChars(command)).toBe(true)
  })
})
