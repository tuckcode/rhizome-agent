import { describe, expect, it } from 'vitest'
import {
  buildPromoteNoteFromChat,
  promoteNoteRelativePath,
  titleFromChatContent,
} from './promoteChatToVault'

describe('promoteChatToVault', () => {
  it('prefers the first markdown heading for the title', () => {
    expect(titleFromChatContent('# Hello world\n\nbody')).toBe('Hello world')
  })

  it('falls back to the first non-empty line', () => {
    expect(titleFromChatContent('\n\nPlain line\nmore')).toBe('Plain line')
  })

  it('builds an inbox path with date slug', () => {
    const at = new Date(2026, 7, 9) // month is 0-based → Aug 9
    expect(promoteNoteRelativePath('Hello world', at)).toBe('inbox/20260809-hello-world.md')
  })

  it('builds markdown with frontmatter and body', () => {
    const at = new Date(2026, 7, 9)
    const note = buildPromoteNoteFromChat('## Kernel notes\n\nDurable bit.', at)
    expect(note.path).toBe('inbox/20260809-kernel-notes.md')
    expect(note.title).toBe('Kernel notes')
    expect(note.content).toContain('source: prime-chat-promote')
    expect(note.content).toContain('# Kernel notes')
    expect(note.content).toContain('Durable bit.')
  })
})
