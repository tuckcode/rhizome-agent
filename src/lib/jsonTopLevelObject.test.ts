import { describe, expect, it } from 'vitest'
import { topLevelJsonValueLiterals } from './jsonTopLevelObject'

describe('topLevelJsonValueLiterals', () => {
  it('reads top-level keys and keeps the last duplicate', () => {
    expect(topLevelJsonValueLiterals('{"timeout_secs":7,"timeout_secs":30}')).toEqual({
      timeout_secs: '30',
    })
  })

  it('ignores nested timeout_secs and keeps the root value', () => {
    expect(topLevelJsonValueLiterals('{"x":{"timeout_secs":7.5},"timeout_secs":30}')).toEqual({
      x: '{"timeout_secs":7.5}',
      timeout_secs: '30',
    })
  })

  it('decodes a unicode-escaped timeout_secs key', () => {
    expect(topLevelJsonValueLiterals('{"timeout\\u005fsecs":12}')).toEqual({
      timeout_secs: '12',
    })
  })

  it('keeps a 7.0 literal instead of turning it into 7', () => {
    expect(topLevelJsonValueLiterals('{"timeout_secs":7.0}')?.timeout_secs).toBe('7.0')
  })

  it('trims only JSON whitespace around the object', () => {
    expect(topLevelJsonValueLiterals(' \t\n\r{"a":1}\r\n ')).toEqual({ a: '1' })
  })

  it('does not treat NBSP as JSON whitespace', () => {
    expect(topLevelJsonValueLiterals('\u00A0{"a":1}')).toBeUndefined()
  })

  it('rejects a non-object and trailing junk', () => {
    expect(topLevelJsonValueLiterals('[1]')).toBeUndefined()
    expect(topLevelJsonValueLiterals('{"a":1} true')).toBeUndefined()
  })
})
