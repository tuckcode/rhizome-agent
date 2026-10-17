import { describe, expect, it } from 'vitest'
import { commitSubject } from './commitSubject'

describe('commitSubject', () => {
  it('returns the first line of a multiline commit message', () => {
    expect(commitSubject('Update project notes\n\nAdd the experiment write-up.')).toBe(
      'Update project notes',
    )
  })

  it('trims surrounding whitespace on a single-line subject', () => {
    expect(commitSubject('  Reorganize people notes  ')).toBe('Reorganize people notes')
  })

  it('returns an empty string for a blank message', () => {
    expect(commitSubject('')).toBe('')
  })
})
