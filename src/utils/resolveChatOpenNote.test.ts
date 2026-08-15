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

  it('resolves a wikilink title to the vault file path', () => {
    const entries = [{
      path: '/Users/dtc/Documents/Rhizome Vault/inbox/20260814-promote-loop.md',
      filename: '20260814-promote-loop.md',
      title: 'Promote loop check',
      aliases: [],
    }] as unknown as import('../types').VaultEntry[]

    expect(resolveChatOpenNote(
      'Promote loop check',
      '/Users/dtc/Documents/Rhizome Vault',
      entries,
    )).toEqual({
      path: '/Users/dtc/Documents/Rhizome Vault/inbox/20260814-promote-loop.md',
      label: 'inbox/20260814-promote-loop.md',
    })
  })
})
