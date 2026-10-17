import { describe, expect, it } from 'vitest'
import { segmentGraphemes, sliceGraphemes } from './graphemeSlice'

describe('graphemeSlice', () => {
  it('counts a ZWJ emoji family as one grapheme', () => {
    const family = '👨‍👩‍👧‍👦'
    expect([...family].length).toBeGreaterThan(1)
    expect(segmentGraphemes(family)).toEqual([family])
    expect(sliceGraphemes(`${family}abc`, 2)).toBe(`${family}a…`)
  })

  it('caps at the requested grapheme count and adds an ellipsis', () => {
    expect(sliceGraphemes('abcdef', 3)).toBe('abc…')
    expect(sliceGraphemes('abc', 3)).toBe('abc')
  })
})
