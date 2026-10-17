import { describe, expect, it } from 'vitest'
import { commitSubject } from './commitSubject'

const LONG_SUBJECT = 'Update project notes and add a very long experiment title that must stay readable'

describe('commitSubject', () => {
  it('returns the first line of a multiline commit message', () => {
    expect(commitSubject('Update project notes\n\nAdd the experiment write-up.')).toBe(
      'Update project notes',
    )
  })

  it('trims surrounding whitespace on a single-line subject', () => {
    expect(commitSubject('  Reorganize people notes  ')).toBe('Reorganize people notes')
  })

  it('uses the first non-blank line when leading lines are empty', () => {
    expect(commitSubject('\n\nUpdate project notes')).toBe('Update project notes')
  })

  it('skips a whitespace-only first line', () => {
    expect(commitSubject('   \nReorganize people notes')).toBe('Reorganize people notes')
  })

  it('treats a lone carriage return as a line break', () => {
    expect(commitSubject('Update project notes\rAdd the experiment write-up.')).toBe(
      'Update project notes',
    )
    expect(commitSubject('\r')).toBe('')
  })

  it('keeps emoji in the subject', () => {
    expect(commitSubject('🌱 Plant the notes\n\nBody')).toBe('🌱 Plant the notes')
  })

  it('keeps a long subject intact', () => {
    expect(commitSubject(`${LONG_SUBJECT}\n\nBody`)).toBe(LONG_SUBJECT)
  })

  it('returns an empty string for a blank message', () => {
    expect(commitSubject('')).toBe('')
    expect(commitSubject('\n\n')).toBe('')
    expect(commitSubject('   \r  ')).toBe('')
  })
})
