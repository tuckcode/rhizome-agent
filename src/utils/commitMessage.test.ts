import { describe, it, expect } from 'vitest'
import { generateCommitMessage } from './commitMessage'
import type { ModifiedFile } from '../types'

function file(relativePath: string, status: ModifiedFile['status'] = 'modified'): ModifiedFile {
  return { path: `/vault/${relativePath}`, relativePath, status }
}

describe('generateCommitMessage', () => {
  it('returns empty string for no files', () => {
    expect(generateCommitMessage([])).toBe('')
  })

  it('uses note title for a single modified file', () => {
    expect(generateCommitMessage([file('winter-2026.md')])).toBe('Update winter-2026')
  })

  it('strips .md extension from the name', () => {
    expect(generateCommitMessage([file('thoughts-on-testing.md')])).toBe('Update thoughts-on-testing')
  })

  it('uses basename for files in subdirectories', () => {
    expect(generateCommitMessage([file('notes/deep/idea.md')])).toBe('Update idea')
  })

  it('lists 2 files comma-separated', () => {
    const msg = generateCommitMessage([file('alpha.md'), file('beta.md')])
    expect(msg).toBe('Update alpha, beta')
  })

  it('lists 3 files comma-separated', () => {
    const msg = generateCommitMessage([
      file('alpha.md'),
      file('beta.md'),
      file('gamma.md'),
    ])
    expect(msg).toBe('Update alpha, beta, gamma')
  })

  it('uses count for 4+ files', () => {
    const msg = generateCommitMessage([
      file('a.md'),
      file('b.md'),
      file('c.md'),
      file('d.md'),
    ])
    expect(msg).toBe('Update 4 notes')
  })

  it('says "Add" for a single new/untracked file', () => {
    expect(generateCommitMessage([file('new-idea.md', 'untracked')])).toBe('Add new-idea')
  })

  it('says "Add" for a single added file', () => {
    expect(generateCommitMessage([file('new-idea.md', 'added')])).toBe('Add new-idea')
  })

  it('says "Delete" for a single deleted file', () => {
    expect(generateCommitMessage([file('old-note.md', 'deleted')])).toBe('Delete old-note')
  })

  it('says "Rename" for a single renamed file', () => {
    expect(generateCommitMessage([file('renamed.md', 'renamed')])).toBe('Rename renamed')
  })

  it('uses "Update" when statuses are mixed', () => {
    const msg = generateCommitMessage([
      file('alpha.md', 'modified'),
      file('beta.md', 'untracked'),
    ])
    expect(msg).toBe('Update alpha, beta')
  })
})
