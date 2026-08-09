import { describe, expect, it } from 'vitest'
import { generateAutomaticCommitMessage } from './automaticCommitMessage'
import type { ModifiedFile } from '../types'

function file(relativePath: string): ModifiedFile {
  return {
    path: `/vault/${relativePath}`,
    relativePath,
    status: 'modified',
  }
}

describe('generateAutomaticCommitMessage', () => {
  it('returns an empty string when there is nothing to commit', () => {
    expect(generateAutomaticCommitMessage([])).toBe('')
  })

  it('counts markdown files as notes', () => {
    expect(generateAutomaticCommitMessage([file('note-a.md')])).toBe('Updated 1 note')
    expect(generateAutomaticCommitMessage([file('note-a.md'), file('note-b.md')])).toBe('Updated 2 notes')
  })

  it('falls back to files when any modified path is not markdown', () => {
    expect(generateAutomaticCommitMessage([file('note-a.md'), file('attachments/image.png')])).toBe('Updated 2 files')
  })
})
