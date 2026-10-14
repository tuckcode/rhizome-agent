import { describe, expect, it } from 'vitest'
import { noteFolderLabel } from './noteFolderLabel'

describe('noteFolderLabel', () => {
  it('returns the last folder segment before the filename', () => {
    expect(noteFolderLabel('/vault/wiki/pattern.md', 'pattern.md')).toBe('wiki')
    expect(noteFolderLabel('/vault/note/test.md', 'test.md')).toBe('note')
  })

  it('returns null when the note sits at the path root', () => {
    expect(noteFolderLabel('readme.md', 'readme.md')).toBeNull()
  })

  it('normalizes Windows separators', () => {
    expect(noteFolderLabel('C:\\vault\\projects\\plan.md', 'plan.md')).toBe('projects')
  })
})
