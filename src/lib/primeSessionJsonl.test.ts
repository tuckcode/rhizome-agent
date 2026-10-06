import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { primeTranscriptItemsFromJsonl } from './primeSessionJsonl'
import { createSessionTranscriptIndex } from './sessionTranscriptSearch'

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/prime-sessions/daemon-transport.jsonl',
)

function readFixture(): string {
  return readFileSync(fixturePath, 'utf8')
}

describe('prime session jsonl fixtures', () => {
  it('ships a real-shaped Prime log with header noise and searchable prose', () => {
    const jsonl = readFixture()

    expect(jsonl).toContain('"type":"session"')
    expect(jsonl).toContain('"type":"session_info"')
    expect(jsonl).toContain('"type":"agent_status"')
    expect(jsonl).toContain('"type":"message"')
    expect(jsonl).toContain('"type":"compaction"')
    expect(jsonl).toContain('/Users/mock/')
  })

  it('indexes user turns and assistant prose from the shipped jsonl and drops tool noise', async () => {
    const items = primeTranscriptItemsFromJsonl(readFixture())
    const kinds = items.map((item) => item.kind)
    expect(kinds).toEqual(['modelChange', 'message', 'message', 'message', 'compaction', 'message', 'message'])

    const index = createSessionTranscriptIndex({
      listSessions: async () => [{
        id: '01a009fc-98f1-7219-858e-5bd22e766bc1',
        path: '/Users/mock/.prime/agent/sessions/01a009fc-98f1-7219-858e-5bd22e766bc1.jsonl',
        title: 'Daemon transport notes',
        mtimeMs: 1,
      }],
      readTranscript: async () => items,
    })

    const transportHits = await index.search('daemon transport')
    expect(transportHits.map((hit) => hit.messageIndex)).toEqual([2])
    expect(transportHits[0]).toMatchObject({
      role: 'assistant',
      excerpt: expect.stringContaining('named socket'),
    })
    expect(transportHits.some((hit) => hit.excerpt.includes('secret'))).toBe(false)
    expect(transportHits.some((hit) => hit.excerpt.includes('tool output'))).toBe(false)

    const socketHits = await index.search('socket')
    expect(socketHits.map((hit) => ({ index: hit.messageIndex, role: hit.role }))).toEqual([
      { index: 1, role: 'user' },
      { index: 2, role: 'assistant' },
    ])
    expect(socketHits[0].excerpt).toContain('where did we leave the socket')
  })
})
