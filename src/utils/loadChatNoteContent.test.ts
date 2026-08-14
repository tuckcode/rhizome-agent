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
      '/Users/dtc/Documents/Laputa',
    )).resolves.toBe('# Memory loop\n\nPromote is explicit.')

    expect(mockInvoke).toHaveBeenCalledWith('get_note_content', {
      path: '/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md',
      vaultPath: '/Users/dtc/Documents/Laputa',
    })
  })

  it('does not double-prefix an absolute path', async () => {
    await loadChatNoteContent(
      '/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md',
      '/Users/dtc/Documents/Laputa',
    )

    expect(mockInvoke).toHaveBeenCalledWith('get_note_content', {
      path: '/Users/dtc/Documents/Laputa/wiki/decisions/memory-loop.md',
      vaultPath: '/Users/dtc/Documents/Laputa',
    })
  })
})
