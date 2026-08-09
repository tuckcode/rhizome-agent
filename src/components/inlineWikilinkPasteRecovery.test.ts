import { describe, expect, it } from 'vitest'
import {
  buildPendingPasteState,
  shouldRecoverPendingPaste,
} from './inlineWikilinkPasteRecovery'

describe('inlineWikilinkPasteRecovery', () => {
  it('recognizes the expected post-paste value as recoverable', () => {
    const pendingPaste = buildPendingPasteState(' ', { start: 1, end: 1 }, 'hello world')

    expect(pendingPaste).toEqual({
      duplicatedValue: ' hello worldhello world',
      expectedValue: ' hello world',
      expectedSelection: { start: 12, end: 12 },
    })
    expect(shouldRecoverPendingPaste(' hello world', pendingPaste)).toBe(true)
  })

  it('recognizes the duplicate native replay as recoverable when pasting into the middle of text', () => {
    const pendingPaste = buildPendingPasteState('prefix suffix', { start: 7, end: 7 }, 'hello ')

    expect(pendingPaste.duplicatedValue).toBe('prefix hello hello suffix')
    expect(shouldRecoverPendingPaste('prefix hello hello suffix', pendingPaste)).toBe(true)
    expect(shouldRecoverPendingPaste('prefix hello suffix!', pendingPaste)).toBe(false)
  })
})
