import { describe, expect, it } from 'vitest'
import { chatHomePrefillForNote, recentNotesForChatHome } from './chatHomeNotes'
import type { VaultEntry } from '../types'

function entry(extra: Partial<VaultEntry>): VaultEntry {
  return {
    path: '/vault/a.md',
    filename: 'a.md',
    title: 'A',
    modifiedAt: 100,
    archived: false,
    ...extra,
  } as VaultEntry
}

describe('recentNotesForChatHome', () => {
  it('returns the notes that changed last, newest first', () => {
    const notes = recentNotesForChatHome([
      entry({ path: '/v/old.md', title: 'Old', modifiedAt: 10 }),
      entry({ path: '/v/new.md', title: 'New', modifiedAt: 30 }),
      entry({ path: '/v/mid.md', title: 'Mid', modifiedAt: 20 }),
    ])
    expect(notes.map((note) => note.title)).toEqual(['New', 'Mid', 'Old'])
  })

  it('stops at four notes', () => {
    const entries = Array.from({ length: 9 }, (_, index) => (
      entry({ path: `/v/${index}.md`, title: `Note ${index}`, modifiedAt: index })
    ))
    expect(recentNotesForChatHome(entries)).toHaveLength(4)
  })

  it('leaves out archived notes, binary files and notes with no date', () => {
    const notes = recentNotesForChatHome([
      entry({ path: '/v/a.md', title: 'Archived', archived: true }),
      entry({ path: '/v/b.png', title: 'Image', fileKind: 'binary' }),
      entry({ path: '/v/c.md', title: 'No date', modifiedAt: null }),
      entry({ path: '/v/d.md', title: 'Kept' }),
    ])
    expect(notes.map((note) => note.title)).toEqual(['Kept'])
  })

  it('uses the file name when a note has no title', () => {
    const notes = recentNotesForChatHome([entry({ title: '', filename: 'untitled-3.md' })])
    expect(notes[0].title).toBe('untitled-3')
  })
})

describe('chatHomePrefillForNote', () => {
  it('puts the note in the composer as a wikilink with a space after it', () => {
    expect(chatHomePrefillForNote({ path: '/v/plan.md', title: 'Weekly Plan 4', modifiedAt: 1 }))
      .toBe('[[Weekly Plan 4]] ')
  })
})
