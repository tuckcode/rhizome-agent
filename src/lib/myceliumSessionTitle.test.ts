import { describe, expect, it } from 'vitest'
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

  it('disambiguates identical untitled rows with the id tail', () => {
    expect(myceliumSessionTitles([
      { id: '01a0252e-b6b9-749a-ad79-4c8c33e521f9' },
      { id: '01a0252e-c4d1-7fa2-9b10-77c1de904ab3', title: '  ' },
      { id: '01a0208e-3494-73a9-a6a2-2b890838d7a5', title: 'Draft the release notes' },
    ])).toEqual([
      'Untitled session · e521f9',
      'Untitled session · 904ab3',
      'Draft the release notes',
    ])
  })
})
