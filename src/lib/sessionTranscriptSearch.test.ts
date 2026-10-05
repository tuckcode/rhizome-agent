import { describe, expect, it, vi } from 'vitest'
import type { PrimeTranscriptItem } from './primeTranscriptToConversation'
import {
  createSessionTranscriptIndex,
  openSessionTranscriptHit,
  requestOpenSessionTranscriptHit,
  subscribeSessionTranscriptHitOpen,
  type SessionTranscriptSource,
} from './sessionTranscriptSearch'

const historyOpen = ['<', 'conversation_history', '>'].join('')
const historyClose = ['</', 'conversation_history', '>'].join('')

function message(
  role: string,
  text: string,
  extra?: Partial<Extract<PrimeTranscriptItem, { kind: 'message' }>>,
): PrimeTranscriptItem {
  return {
    kind: 'message',
    message: { role, content: [{ type: 'text', text }], text },
    ...extra,
  }
}

function daemonTranscript(): PrimeTranscriptItem[] {
  return [
    { kind: 'agent_status', status: 'thinking' } as unknown as PrimeTranscriptItem,
    message('custom', 'agent_status thinking about the daemon transport'),
    message('user', [
      historyOpen,
      '[user]: earlier note',
      '',
      '[assistant]: system prompt mentions daemon transport',
      '',
      '[user]: where did we leave the socket',
      historyClose,
    ].join('\n')),
    message('toolResult', 'tool output mentions daemon transport in the log'),
    message('assistant', 'Done.', {
      tools: [{ tool: 'read', detail: 'daemon transport secret' }],
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'daemon transport secret plan' },
          { type: 'text', text: 'The daemon transport uses a named socket.' },
        ],
        text: 'The daemon transport uses a named socket.',
      },
    }),
    { kind: 'compaction', summary: 'daemon transport was settled here' },
  ]
}

function source(path: string, mtimeMs: number, title = 'Daemon notes'): SessionTranscriptSource {
  return { id: path, path, title, mtimeMs }
}

describe('session transcript search', () => {
  it('finds user turns and assistant prose and drops tool noise', async () => {
    const readTranscript = vi.fn(async () => daemonTranscript())
    const index = createSessionTranscriptIndex({
      listSessions: async () => [source('/sessions/daemon.jsonl', 10)],
      readTranscript,
    })

    const hits = await index.search('daemon transport')

    expect(hits.map((hit) => hit.messageIndex)).toEqual([4])
    expect(hits[0]).toMatchObject({
      sessionPath: '/sessions/daemon.jsonl',
      sessionTitle: 'Daemon notes',
      role: 'assistant',
      messageIndex: 4,
    })
    expect(hits[0].excerpt).toContain('named socket')
    expect(hits.some((hit) => hit.excerpt.includes('secret'))).toBe(false)

    const userHits = await index.search('socket')
    expect(userHits.map((hit) => ({ index: hit.messageIndex, role: hit.role }))).toEqual([
      { index: 2, role: 'user' },
      { index: 4, role: 'assistant' },
    ])
    expect(readTranscript).toHaveBeenCalledTimes(1)
  })

  it('does not read an unchanged session again on a second search', async () => {
    const readTranscript = vi.fn(async () => daemonTranscript())
    const index = createSessionTranscriptIndex({
      listSessions: async () => [source('/sessions/daemon.jsonl', 10)],
      readTranscript,
    })

    await index.search('socket')
    await index.search('named')

    expect(readTranscript).toHaveBeenCalledTimes(1)
    expect(readTranscript).toHaveBeenCalledWith('/sessions/daemon.jsonl')
  })

  it('shares one read when two searches overlap before the transcript returns', async () => {
    let release: (items: PrimeTranscriptItem[]) => void = () => {}
    const readTranscript = vi.fn(() => new Promise<PrimeTranscriptItem[]>((resolve) => {
      release = resolve
    }))
    const index = createSessionTranscriptIndex({
      listSessions: async () => [source('/sessions/daemon.jsonl', 10)],
      readTranscript,
    })

    const first = index.search('socket')
    const second = index.search('named')
    await vi.waitFor(() => expect(readTranscript).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(readTranscript).toHaveBeenCalledTimes(1)
    release(daemonTranscript())

    const [firstHits, secondHits] = await Promise.all([first, second])
    expect(firstHits).toHaveLength(2)
    expect(secondHits).toHaveLength(1)
  })

  it('drops a session that the list no longer contains', async () => {
    const transcripts: Record<string, PrimeTranscriptItem[]> = {
      '/sessions/keep.jsonl': [message('user', 'keep the socket notes')],
      '/sessions/drop.jsonl': [message('user', 'drop the socket notes')],
    }
    let listed = [
      source('/sessions/keep.jsonl', 1, 'Keep'),
      source('/sessions/drop.jsonl', 1, 'Drop'),
    ]
    const readTranscript = vi.fn(async (path: string) => transcripts[path] ?? [])
    const index = createSessionTranscriptIndex({
      listSessions: async () => listed,
      readTranscript,
    })

    const first = await index.search('socket')
    expect(first.map((hit) => hit.sessionPath).sort()).toEqual([
      '/sessions/drop.jsonl',
      '/sessions/keep.jsonl',
    ])

    listed = [source('/sessions/keep.jsonl', 1, 'Keep')]
    const second = await index.search('socket')

    expect(second.map((hit) => hit.sessionPath)).toEqual(['/sessions/keep.jsonl'])
    expect(index.indexedPaths()).toEqual(['/sessions/keep.jsonl'])
    expect(readTranscript.mock.calls.filter((call) => call[0] === '/sessions/keep.jsonl')).toHaveLength(1)
    expect(readTranscript.mock.calls.filter((call) => call[0] === '/sessions/drop.jsonl')).toHaveLength(1)
  })

  it('re-reads a session whose list stamp changed', async () => {
    let items = [message('assistant', 'old socket')]
    let listed = [source('/sessions/daemon.jsonl', 1)]
    const readTranscript = vi.fn(async () => items)
    const index = createSessionTranscriptIndex({
      listSessions: async () => listed,
      readTranscript,
    })

    await index.search('socket')
    items = [message('assistant', 'new pipe')]
    listed = [source('/sessions/daemon.jsonl', 2)]
    const hits = await index.search('pipe')

    expect(readTranscript).toHaveBeenCalledTimes(2)
    expect(hits).toHaveLength(1)
    expect(hits[0].excerpt).toContain('new pipe')
  })

  it('omits a session the reader cannot open', async () => {
    const readTranscript = vi.fn(async (path: string) => {
      if (path.endsWith('gone.jsonl')) throw new Error('missing log')
      return [message('user', 'the socket is here')]
    })
    const index = createSessionTranscriptIndex({
      listSessions: async () => [
        source('/sessions/keep.jsonl', 1, 'Keep'),
        source('/sessions/gone.jsonl', 1, 'Gone'),
      ],
      readTranscript,
    })

    const hits = await index.search('socket')

    expect(hits.map((hit) => hit.sessionPath)).toEqual(['/sessions/keep.jsonl'])
    expect(index.indexedPaths()).toEqual(['/sessions/keep.jsonl'])
  })

  it('opens a hit through the existing switch and read path', async () => {
    const transcript = daemonTranscript()
    const switchSession = vi.fn(async () => 'ok')
    const readTranscript = vi.fn(async () => transcript)

    const opened = await openSessionTranscriptHit(
      { sessionPath: '/sessions/daemon.jsonl', messageIndex: 4 },
      { switchSession, readTranscript },
    )

    expect(switchSession).toHaveBeenCalledWith('/sessions/daemon.jsonl')
    expect(readTranscript).toHaveBeenCalledWith('/sessions/daemon.jsonl')
    expect(switchSession.mock.invocationCallOrder[0]).toBeLessThan(readTranscript.mock.invocationCallOrder[0])
    expect(opened.messageIndex).toBe(4)
    expect(opened.transcript).toBe(transcript)
  })

  it('asks the live chat to open a hit', () => {
    const opened = vi.fn()
    const unsubscribe = subscribeSessionTranscriptHitOpen(opened)
    const hit = {
      sessionId: 'daemon',
      sessionPath: '/sessions/daemon.jsonl',
      sessionTitle: 'Daemon notes',
      messageIndex: 4,
      role: 'assistant' as const,
      excerpt: 'named socket',
    }

    requestOpenSessionTranscriptHit(hit)
    unsubscribe()
    requestOpenSessionTranscriptHit(hit)

    expect(opened).toHaveBeenCalledTimes(1)
    expect(opened).toHaveBeenCalledWith(hit)
  })
})
