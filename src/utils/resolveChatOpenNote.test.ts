import { describe, expect, it } from 'vitest'
import { resolveChatOpenNote } from './resolveChatOpenNote'

describe('resolveChatOpenNote', () => {
  it('keeps chat on the conversation and labels the note relative to the vault', () => {
    expect(resolveChatOpenNote(
      '/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md',
      '/Users/dtc/Documents/Laputa',
    )).toEqual({
      path: '/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md',
      label: 'wiki/decisions/memory-loop.md',
    })
  })

  it('returns null for a blank target', () => {
    expect(resolveChatOpenNote('   ', '/vault')).toBeNull()
  })

  it('keeps a vault-relative path as the label', () => {
    expect(resolveChatOpenNote('wiki/decisions/memory-loop.md', '/Users/dtc/Documents/Laputa')).toEqual({
      path: 'wiki/decisions/memory-loop.md',
      label: 'wiki/decisions/memory-loop.md',
    })
  })
})
