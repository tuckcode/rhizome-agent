import { describe, expect, it, vi } from 'vitest'

import { initializeNoteProperties } from './initializeNoteProperties'

describe('initializeNoteProperties', () => {
  it('seeds only the Note type without creating a title field', async () => {
    const updateFrontmatter = vi.fn().mockResolvedValue(undefined)

    await initializeNoteProperties(updateFrontmatter, '/vault/plain-note.md')

    expect(updateFrontmatter).toHaveBeenCalledTimes(1)
    expect(updateFrontmatter).toHaveBeenCalledWith(
      '/vault/plain-note.md',
      'type',
      'Note',
      { silent: true },
    )
  })
})
