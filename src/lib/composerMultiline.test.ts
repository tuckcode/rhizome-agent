import { describe, expect, it } from 'vitest'
import { COMPOSER_MULTILINE_THRESHOLD_PX, composerIsMultiline } from './composerMultiline'

describe('composerIsMultiline', () => {
  it('is false at the 32px threshold so a single line at zoom is not a wrap', () => {
    expect(composerIsMultiline({ scrollHeight: 30 })).toBe(false)
    expect(composerIsMultiline({ scrollHeight: 31 })).toBe(false)
    expect(composerIsMultiline({ scrollHeight: COMPOSER_MULTILINE_THRESHOLD_PX })).toBe(false)
  })

  it('is true when scrollHeight grows past 32px, even without a newline', () => {
    expect(composerIsMultiline({ scrollHeight: COMPOSER_MULTILINE_THRESHOLD_PX + 1 })).toBe(true)
    expect(composerIsMultiline({ scrollHeight: 56 })).toBe(true)
  })
})
