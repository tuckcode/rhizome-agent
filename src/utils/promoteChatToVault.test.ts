import { describe, expect, it, vi } from 'vitest'
import {
  buildPromoteNoteFromChat,
  isRawTimestampTitle,
  promoteNoteRelativePath,
  promoteSessionFromHost,
  titleFromChatContent,
  writePromoteNoteFromChat,
} from './promoteChatToVault'

const at = new Date(2026, 7, 9) // month is 0-based → Aug 9

describe('promoteChatToVault', () => {
  it('prefers the first # or ## heading for the title', () => {
    expect(titleFromChatContent('# Hello world\n\nbody')).toBe('Hello world')
    expect(titleFromChatContent('## Kernel notes\n\nDurable bit.')).toBe('Kernel notes')
  })

  it('ignores ###+ headings and derives a first sentence instead', () => {
    expect(titleFromChatContent('### Skip me\n\nThe real sentence is here. More.')).toBe(
      'The real sentence is here.',
    )
  })

  it('derives a short first-sentence title when there is no heading', () => {
    expect(titleFromChatContent('\n\nThe kernel notes are ready. More follows.')).toBe(
      'The kernel notes are ready.',
    )
  })

  it('never uses a raw timestamp as the title', () => {
    expect(isRawTimestampTitle('2026-08-26')).toBe(true)
    expect(isRawTimestampTitle('20260826')).toBe(true)
    expect(titleFromChatContent('# 2026-08-26\n\nUseful sentence here.')).toBe('Useful sentence here.')
    expect(titleFromChatContent('# 20260809')).toBe('Promoted from chat')
  })

  it('builds a raw/inbox path with date slug', () => {
    expect(promoteNoteRelativePath('Hello world', at)).toBe('raw/inbox/20260809-hello-world.md')
  })

  it('builds vault-shaped frontmatter and keeps the selected body', () => {
    const note = buildPromoteNoteFromChat('## Kernel notes\n\nDurable bit.', at)
    expect(note.path).toBe('raw/inbox/20260809-kernel-notes.md')
    expect(note.title).toBe('Kernel notes')
    expect(note.content).toContain('title: "Kernel notes"')
    expect(note.content).toContain('is_a: Note')
    expect(note.content).toContain('created: 2026-08-09')
    expect(note.content).toContain('source: prime-chat-promote')
    expect(note.content).not.toContain('session:')
    expect(note.content).toContain('# Kernel notes')
    expect(note.content).toContain('Durable bit.')
  })

  it('records session provenance when Chat passes one', () => {
    const note = buildPromoteNoteFromChat('A sentence about the session.', at, {
      session: 'sess-abc',
    })
    expect(note.content).toContain('session: "sess-abc"')
  })

  it('prefers a live session id over the session log path', () => {
    expect(promoteSessionFromHost(' sess-1 ', '/tmp/prime.jsonl')).toBe('sess-1')
    expect(promoteSessionFromHost(null, ' /tmp/prime.jsonl ')).toBe('/tmp/prime.jsonl')
    expect(promoteSessionFromHost('  ', '')).toBeUndefined()
  })

  it('passes existing wikilinks through and does not invent new ones', () => {
    const source = 'See [[Kernel]] and [[Inbox|the inbox]] for the durable bit.'
    const note = buildPromoteNoteFromChat(source, at)
    expect(note.content).toContain('[[Kernel]]')
    expect(note.content).toContain('[[Inbox|the inbox]]')
    const invented = note.content.match(/\[\[/g) ?? []
    const original = source.match(/\[\[/g) ?? []
    expect(invented).toHaveLength(original.length)
  })

  it('refuses a second write to the same path', async () => {
    const persist = vi.fn()
    const first = await writePromoteNoteFromChat('Hello world. Extra.', at, {
      pathExists: async () => false,
      persist,
    })
    expect(first.status).toBe('saved')
    expect(first.note.path).toBe('raw/inbox/20260809-hello-world.md')
    expect(persist).toHaveBeenCalledTimes(1)

    const second = await writePromoteNoteFromChat('Hello world. Extra.', at, {
      pathExists: async (path) => path === first.note.path,
      persist,
    })
    expect(second.status).toBe('duplicate')
    expect(second.note.path).toBe(first.note.path)
    expect(persist).toHaveBeenCalledTimes(1)
  })
})
