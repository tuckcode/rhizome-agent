import { afterEach, describe, expect, it, vi } from 'vitest'
import { myceliumSessionTitle, myceliumSessionTitles } from './myceliumSessionTitle'

const BLOB = [
  '<conversation_history>',
  '[user]: hi',
  '',
  '[assistant]: Hello.',
  '',
  '[user]: hide chat on notes',
  '</conversation_history>',
  '',
  'Continue the conversation. Respond only to the latest [user] message.',
].join('\n')

describe('myceliumSessionTitle', () => {
  it('keeps a real title', () => {
    expect(myceliumSessionTitle('Where does the vault watcher debounce?'))
      .toBe('Where does the vault watcher debounce?')
  })

  it('uses the first user turn inside a conversation_history blob', () => {
    expect(myceliumSessionTitle(BLOB)).toBe('hi')
  })

  it('falls back when the title is missing or has no user turn', () => {
    expect(myceliumSessionTitle(null)).toBe('Untitled session')
    expect(myceliumSessionTitle('   ')).toBe('Untitled session')
    expect(myceliumSessionTitle('<conversation_history>\n[assistant]: only\n</conversation_history>'))
      .toBe('Untitled session')
  })

  it('disambiguates identical titles with the session age', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'))
    const now = Date.now()
    expect(myceliumSessionTitles([
      { id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9', mtimeMs: now - 2 * 60 * 60 * 1000 },
      { id: '01a0252e-c4d1-7fa2-9b10-77c1de904ab3', title: '  ', mtimeMs: now - 26 * 60 * 60 * 1000 },
      { id: '01a0208e-3494-73a9-a6a2-2b890838d7a5', title: 'Draft the release notes', mtimeMs: now },
      { id: '01a0208e-3494-73a9-a6a2-2b890838d7a6', title: 'Draft the release notes', mtimeMs: now - 5 * 60 * 60 * 1000 },
    ])).toEqual([
      'Untitled session · 2h ago',
      'Untitled session · 1d ago',
      'Draft the release notes · just now',
      'Draft the release notes · 5h ago',
    ])
  })

  it('adds a short id only when duplicate titles share an age', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'))
    const now = Date.now()
    const twoHours = now - 2 * 60 * 60 * 1000
    expect(myceliumSessionTitles([
      { id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9', mtimeMs: twoHours },
      { id: '01a0252e-c4d1-7fa2-9b10-77c1de904ab3', mtimeMs: twoHours - 30 * 60 * 1000 },
      { id: '01a0208e-3494-73a9-a6a2-2b890838aaaa', title: 'Draft' },
      { id: '01a0208e-3494-73a9-a6a2-2b890838bbbb', title: 'Draft', mtimeMs: Number.NaN },
    ])).toEqual([
      'Untitled session · 2h ago · e521f9',
      'Untitled session · 2h ago · 904ab3',
      'Draft · undated · 38aaaa',
      'Draft · undated · 38bbbb',
    ])
  })

  it('clips a long title on grapheme boundaries', () => {
    const family = '👨‍👩‍👧‍👦'
    expect(family.length).toBeGreaterThan(2)
    const clipped = myceliumSessionTitle(family.repeat(81))
    expect(clipped.endsWith('…')).toBe(true)
    expect(clipped.slice(0, -1)).toBe(family.repeat(80))
  })
})

afterEach(() => {
  vi.useRealTimers()
})
