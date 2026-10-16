import { describe, expect, it } from 'vitest'
import { middleEllipsis, NATIVE_CHAT_MODEL_CHIP_LABEL_MAX_CHARS } from './middleEllipsis'

describe('middleEllipsis', () => {
  it('leaves short ids intact', () => {
    expect(middleEllipsis('gpt-4o', NATIVE_CHAT_MODEL_CHIP_LABEL_MAX_CHARS)).toBe('gpt-4o')
  })

  it('cuts a long id in the middle', () => {
    expect(middleEllipsis('anthropic-claude-opus-4-very-long-id', 18)).toBe('anthropic…-long-id')
  })
})
