import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (...args: unknown[]) => mockInvoke(...args),
}))

import { loadChatNoteContent } from './loadChatNoteContent'

describe('loadChatNoteContent', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue('# Memory loop\n\nPromote is explicit.')
  })

  it('loads get_note_content for a vault-relative path', async () => {
    await expect(loadChatNoteContent(
      'wiki/decisions/memory-loop.md',
      '/Users/jdoe/Documents/Vault',
    )).resolves.toBe('# Memory loop\n\nPromote is explicit.')

    expect(mockInvoke).toHaveBeenCalledWith('get_note_content', {
      path: '/Users/jdoe/Documents/Vault/wiki/decisions/memory-loop.md',
      vaultPath: '/Users/jdoe/Documents/Vault',
    })
  })

  it('does not double-prefix an absolute path', async () => {
    await loadChatNoteContent(
      '/Users/jdoe/Documents/Vault/wiki/decisions/memory-loop.md',
      '/Users/jdoe/Documents/Vault',
    )

    expect(mockInvoke).toHaveBeenCalledWith('get_note_content', {
      path: '/Users/jdoe/Documents/Vault/wiki/decisions/memory-loop.md',
      vaultPath: '/Users/jdoe/Documents/Vault',
    })
  })
})
