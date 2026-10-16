import { describe, expect, it } from 'vitest'
import { COMPOSER_SINGLE_LINE_HEIGHT_PX, composerIsMultiline } from './composerMultiline'

describe('composerIsMultiline', () => {
  it('is false when scrollHeight matches the single-line floor', () => {
    expect(composerIsMultiline({ scrollHeight: COMPOSER_SINGLE_LINE_HEIGHT_PX })).toBe(false)
  })

  it('is true when scrollHeight grows past one line, even without a newline', () => {
    expect(composerIsMultiline({ scrollHeight: COMPOSER_SINGLE_LINE_HEIGHT_PX + 1 })).toBe(true)
    expect(composerIsMultiline({ scrollHeight: 56 })).toBe(true)
  })
})
