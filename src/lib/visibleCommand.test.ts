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

  it('badges CR in a CRLF pair and keeps the newline marker', () => {
    expect(visibleCommandParts('rg TODO\r\nwiki/')).toEqual([
      { kind: 'text', text: 'rg TODO' },
      { kind: 'hidden', hex: '000D' },
      { kind: 'newline' },
      { kind: 'text', text: 'wiki/' },
    ])
  })

  it('shows ESC as a hex badge', () => {
    expect(visibleCommandParts('echo hi\u001b[31m')).toEqual([
      { kind: 'text', text: 'echo hi' },
      { kind: 'hidden', hex: '001B' },
      { kind: 'text', text: '[31m' },
    ])
  })

  it('shows C1 controls as hex badges', () => {
    expect(visibleCommandParts('echo\u009B')).toEqual([
      { kind: 'text', text: 'echo' },
      { kind: 'hidden', hex: '009B' },
    ])
    expect(commandHasHiddenChars('echo\u009B')).toBe(true)
  })

  it('shows U+2066-2069 isolate controls as hex badges', () => {
    expect(visibleCommandParts('\u2066secret\u2069')).toEqual([
      { kind: 'hidden', hex: '2066' },
      { kind: 'text', text: 'secret' },
      { kind: 'hidden', hex: '2069' },
    ])
  })

  it('shows U+FEFF as a hex badge', () => {
    expect(visibleCommandParts('\uFEFFecho')).toEqual([
      { kind: 'hidden', hex: 'FEFF' },
      { kind: 'text', text: 'echo' },
    ])
  })

  it('shows zero-width and bidi characters as hex badges', () => {
    expect(visibleCommandParts('echo\u200B\u202E')).toEqual([
      { kind: 'text', text: 'echo' },
      { kind: 'hidden', hex: '200B' },
      { kind: 'hidden', hex: '202E' },
    ])
  })

  it('shows tag characters as hex badges', () => {
    expect(visibleCommandParts(`echo\u{E0061}`)).toEqual([
      { kind: 'text', text: 'echo' },
      { kind: 'hidden', hex: 'E0061' },
    ])
  })

  it('shows word joiners, soft hyphen, and line/paragraph separators', () => {
    expect(visibleCommandParts('a\u2060b\u00ADc\u2028d\u2029e')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'hidden', hex: '2060' },
      { kind: 'text', text: 'b' },
      { kind: 'hidden', hex: '00AD' },
      { kind: 'text', text: 'c' },
      { kind: 'hidden', hex: '2028' },
      { kind: 'text', text: 'd' },
      { kind: 'hidden', hex: '2029' },
      { kind: 'text', text: 'e' },
    ])
  })

  it('shows Arabic letter mark and Mongolian vowel separator', () => {
    expect(visibleCommandParts('a\u061Cb\u180Ec')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'hidden', hex: '061C' },
      { kind: 'text', text: 'b' },
      { kind: 'hidden', hex: '180E' },
      { kind: 'text', text: 'c' },
    ])
  })

  it('shows variation selectors as hex badges', () => {
    expect(visibleCommandParts('a\uFE0Fb\u{E0100}c')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'hidden', hex: 'FE0F' },
      { kind: 'text', text: 'b' },
      { kind: 'hidden', hex: 'E0100' },
      { kind: 'text', text: 'c' },
    ])
  })

  it('badges NBSP so rm\\u00A0-rf does not look like rm -rf', () => {
    expect(visibleCommandParts('rm\u00A0-rf')).toEqual([
      { kind: 'text', text: 'rm' },
      { kind: 'hidden', hex: '00A0' },
      { kind: 'text', text: '-rf' },
    ])
    expect(commandHasHiddenChars('rm\u00A0-rf')).toBe(true)
  })

  it('shows Hangul fillers as hex badges', () => {
    expect(visibleCommandParts('\u115F\u1160\u3164\uFFA0')).toEqual([
      { kind: 'hidden', hex: '115F' },
      { kind: 'hidden', hex: '1160' },
      { kind: 'hidden', hex: '3164' },
      { kind: 'hidden', hex: 'FFA0' },
    ])
  })
})
