import { describe, expect, it } from 'vitest'
import { noteOptionId } from './noteOptionId'

describe('noteOptionId', () => {
  it('survives the characters a real note path contains', () => {
    const id = noteOptionId('/Users/dtc/Rhizome Vault/10 - Areas/a.note.md')

    expect(id.startsWith('note-option-')).toBe(true)
    expect(id).not.toMatch(/[/\s%.]/)
  })

  it('is stable, because aria-activedescendant matches by id', () => {
    expect(noteOptionId('/a/b.md')).toBe(noteOptionId('/a/b.md'))
  })

  it('gives different notes different ids', () => {
    expect(noteOptionId('/a/b.md')).not.toBe(noteOptionId('/a/c.md'))
  })

  /** Two paths differing only by an encoded character must not collide. */
  it('does not collapse paths that differ only in punctuation', () => {
    expect(noteOptionId('/a b.md')).not.toBe(noteOptionId('/a-b.md'))
  })
})
