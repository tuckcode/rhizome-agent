import { describe, expect, it } from 'vitest'
import { notePathFromToolInput, updateToolAction } from './aiAgentMessageState'
import type { AiAgentMessage } from './aiAgentConversation'

const base: AiAgentMessage = {
  id: 'm1',
  userMessage: 'q',
  actions: [],
}

describe('notePathFromToolInput', () => {
  it('reads path from create_note JSON', () => {
    expect(notePathFromToolInput('create_note', '{"path":"inbox/a.md"}')).toBe('inbox/a.md')
  })

  it('reads file_path from Write tools', () => {
    expect(notePathFromToolInput('Write', '{"file_path":"/vault/wiki/x.md"}')).toBe('/vault/wiki/x.md')
  })

  it('returns undefined for search without path', () => {
    expect(notePathFromToolInput('search_notes', '{"query":"hi"}')).toBeUndefined()
  })
})

describe('updateToolAction bash preview', () => {
  it('labels a bash wrapper with the recovered command', () => {
    const next = updateToolAction(base, 'bash', 't1', '{"command":"rg foo wiki/"}')
    expect(next.actions[0].label).toBe('rg foo wiki/')
    expect(next.actions[0].tool).toBe('bash')
  })
})

describe('updateToolAction path', () => {
  it('attaches path and labels create_note', () => {
    const next = updateToolAction(base, 'create_note', 't1', '{"path":"inbox/a.md"}')
    expect(next.actions[0]).toMatchObject({
      tool: 'create_note',
      path: 'inbox/a.md',
      status: 'pending',
    })
    expect(next.actions[0].label).toContain('inbox/a.md')
  })
})
