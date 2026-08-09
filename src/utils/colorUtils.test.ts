import { describe, it, expect } from 'vitest'
import { isValidCssColor, expandShortHex, toHexColor, isColorKeyName } from './colorUtils'

describe('isValidCssColor', () => {
  it('recognizes 6-digit hex colors', () => {
    expect(isValidCssColor('#3b82f6')).toBe(true)
    expect(isValidCssColor('#FFFFFF')).toBe(true)
    expect(isValidCssColor('#000000')).toBe(true)
    expect(isValidCssColor('#abcdef')).toBe(true)
  })

  it('recognizes 3-digit hex colors', () => {
    expect(isValidCssColor('#fff')).toBe(true)
    expect(isValidCssColor('#000')).toBe(true)
    expect(isValidCssColor('#abc')).toBe(true)
    expect(isValidCssColor('#F0A')).toBe(true)
  })

  it('recognizes 8-digit hex colors (with alpha)', () => {
    expect(isValidCssColor('#3b82f6ff')).toBe(true)
    expect(isValidCssColor('#00000080')).toBe(true)
  })

  it('recognizes rgb() colors', () => {
    expect(isValidCssColor('rgb(255, 0, 0)')).toBe(true)
    expect(isValidCssColor('rgb(0, 128, 255)')).toBe(true)
    expect(isValidCssColor('rgb( 255 , 255 , 255 )')).toBe(true)
  })

  it('recognizes rgba() colors', () => {
    expect(isValidCssColor('rgba(255, 0, 0, 0.5)')).toBe(true)
    expect(isValidCssColor('rgba(0, 128, 255, 1)')).toBe(true)
  })

  it('recognizes hsl() colors', () => {
    expect(isValidCssColor('hsl(120, 50%, 50%)')).toBe(true)
    expect(isValidCssColor('hsl(0, 100%, 50%)')).toBe(true)
  })

  it('recognizes hsla() colors', () => {
    expect(isValidCssColor('hsla(120, 50%, 50%, 0.5)')).toBe(true)
  })

  it('recognizes named CSS colors', () => {
    expect(isValidCssColor('red')).toBe(true)
    expect(isValidCssColor('blue')).toBe(true)
    expect(isValidCssColor('cornflowerblue')).toBe(true)
    expect(isValidCssColor('rebeccapurple')).toBe(true)
    expect(isValidCssColor('White')).toBe(true)
  })

  it('rejects invalid color strings', () => {
    expect(isValidCssColor('#zzzzzz')).toBe(false)
    expect(isValidCssColor('not-a-color')).toBe(false)
    expect(isValidCssColor('')).toBe(false)
    expect(isValidCssColor('hello')).toBe(false)
    expect(isValidCssColor('#12')).toBe(false)
    expect(isValidCssColor('#1234')).toBe(false)
    expect(isValidCssColor('#12345')).toBe(false)
    expect(isValidCssColor('#1234567')).toBe(false)
  })

  it('rejects null/undefined/non-string', () => {
    expect(isValidCssColor(null as never)).toBe(false)
    expect(isValidCssColor(undefined as never)).toBe(false)
    expect(isValidCssColor(123 as never)).toBe(false)
  })

  it('handles whitespace-padded values', () => {
    expect(isValidCssColor('  #fff  ')).toBe(true)
    expect(isValidCssColor('  red  ')).toBe(true)
  })
})

describe('expandShortHex', () => {
  it('expands #rgb to #rrggbb', () => {
    expect(expandShortHex('#fff')).toBe('#ffffff')
    expect(expandShortHex('#abc')).toBe('#aabbcc')
    expect(expandShortHex('#F0A')).toBe('#FF00AA')
  })

  it('returns non-short-hex values unchanged', () => {
    expect(expandShortHex('#abcdef')).toBe('#abcdef')
    expect(expandShortHex('red')).toBe('red')
  })
})

describe('toHexColor', () => {
  it('converts 6-digit hex (pass-through, lowercased)', () => {
    expect(toHexColor('#3b82f6')).toBe('#3b82f6')
    expect(toHexColor('#FFFFFF')).toBe('#ffffff')
  })

  it('expands 3-digit hex to 6-digit', () => {
    expect(toHexColor('#fff')).toBe('#ffffff')
    expect(toHexColor('#abc')).toBe('#aabbcc')
  })

  it('strips alpha from 8-digit hex', () => {
    expect(toHexColor('#3b82f6ff')).toBe('#3b82f6')
    expect(toHexColor('#00000080')).toBe('#000000')
  })

  it('returns null for rgb/hsl/named when OffscreenCanvas unavailable', () => {
    expect(toHexColor('rgb(255, 0, 0)')).toBeNull()
    expect(toHexColor('red')).toBeNull()
    expect(toHexColor('hsl(120, 50%, 50%)')).toBeNull()
  })

  it('handles whitespace around hex values', () => {
    expect(toHexColor('  #ffffff  ')).toBe('#ffffff')
  })
})

describe('isColorKeyName', () => {
  it('recognizes color-related key names', () => {
    expect(isColorKeyName('color')).toBe(true)
    expect(isColorKeyName('background')).toBe(true)
    expect(isColorKeyName('foreground')).toBe(true)
    expect(isColorKeyName('primary')).toBe(true)
    expect(isColorKeyName('border')).toBe(true)
    expect(isColorKeyName('muted')).toBe(true)
    expect(isColorKeyName('accent-color')).toBe(true)
    expect(isColorKeyName('fill')).toBe(true)
    expect(isColorKeyName('stroke')).toBe(true)
  })

  it('rejects non-color key names', () => {
    expect(isColorKeyName('name')).toBe(false)
    expect(isColorKeyName('status')).toBe(false)
    expect(isColorKeyName('deadline')).toBe(false)
    expect(isColorKeyName('description')).toBe(false)
  })
})
