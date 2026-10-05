import { describe, expect, it } from 'vitest'
import {
  primeTranscriptToConversation,
  transcriptAlongBranch,
  type PrimeTranscriptItem,
} from './primeTranscriptToConversation'

function userMessage(text: string, id = 'u1'): PrimeTranscriptItem {
  return {
    kind: 'message',
    id,
    message: { role: 'user', content: [{ type: 'text', text }], text },
  }
}

function assistant(
  content: unknown[],
  text = '',
  tools?: Array<{ id?: string; tool: string; path?: string; detail?: string }>,
): PrimeTranscriptItem {
  return { kind: 'message', id: 'a1', message: { role: 'assistant', content, text }, tools }
}

describe('primeTranscriptToConversation', () => {
  it('pairs each user message with the assistant response that answered it', () => {
    const turns = primeTranscriptToConversation([
      userMessage('first question'),
      assistant([{ type: 'text', text: 'first answer' }], 'first answer'),
      userMessage('second question', 'u2'),
      assistant([{ type: 'text', text: 'second answer' }], 'second answer'),
    ])

    expect(turns).toHaveLength(2)
    expect(turns[0].userMessage).toBe('first question')
    expect(turns[0].response).toBe('first answer')
    expect(turns[0].transcriptUserIndex).toBe(0)
    expect(turns[0].transcriptAssistantIndex).toBe(1)
    expect(turns[1].userMessage).toBe('second question')
    expect(turns[1].response).toBe('second answer')
    expect(turns[1].transcriptUserIndex).toBe(2)
    expect(turns[1].transcriptAssistantIndex).toBe(3)
  })

  it('shows the latest typed line when the log stored a conversation_history prompt', () => {
    const open = ['<', 'conversation_history', '>'].join('')
    const close = ['</', 'conversation_history', '>'].join('')
    const blob = [
      open,
      '[user]: first question',
      '',
      '[assistant]: first answer',
      '',
      '[user]: forget about it',
      close,
      '',
      'Continue the conversation. Respond only to the latest [user] message.',
    ].join('\n')

    const turns = primeTranscriptToConversation([userMessage(blob)])

    expect(turns[0].userMessage).toBe('forget about it')
    expect(turns[0].userMessage).not.toContain('conversation_history')
  })

  it('drops a history prompt that has no user line instead of showing the tags', () => {
    const open = ['<', 'conversation_history', '>'].join('')
    const close = ['</', 'conversation_history', '>'].join('')
    const turns = primeTranscriptToConversation([userMessage(`${open}\nno turns\n${close}`)])
    expect(turns[0].userMessage).toBe('')
  })

  it('carries Prime message timestamps onto turns as createdAtMs (C70)', () => {
    const ms = new Date(2026, 8, 6, 15, 35, 0).getTime()
    const turns = primeTranscriptToConversation([
      {
        kind: 'message',
        id: 'u-ts',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'when?' }],
          text: 'when?',
          timestamp: ms,
        },
      },
    ])
    expect(turns[0]?.createdAtMs).toBe(ms)
  })

  /** Frame A shows tool cards in the transcript; prose-only replay loses them. */
  it('rebuilds tool cards from the unwrapped tools, with the path when there is one', () => {
    const turns = primeTranscriptToConversation([
      userMessage('read it'),
      assistant(
        [{ type: 'text', text: 'Found a decision note.' }],
        'Found a decision note.',
        [
          { id: 't1', tool: 'search_notes' },
          { id: 't2', tool: 'get_note', path: 'wiki/memory-loop.md' },
        ],
      ),
    ])

    expect(turns[0].actions).toHaveLength(2)
    expect(turns[0].actions[0]).toMatchObject({ tool: 'search_notes', toolId: 't1' })
    expect(turns[0].actions[1]).toMatchObject({
      tool: 'get_note',
      path: 'wiki/memory-loop.md',
      label: 'get_note wiki/memory-loop.md',
    })
    expect(turns[0].response).toBe('Found a decision note.')
  })

  it('uses the recovered command as the replayed card label', () => {
    const turns = primeTranscriptToConversation([
      userMessage('search'),
      assistant([], '', [{ id: 't1', tool: 'bash', detail: 'rg foo wiki/' }]),
    ])

    expect(turns[0].actions[0]).toMatchObject({
      tool: 'bash',
      label: 'rg foo wiki/',
    })
  })

  /** Replayed history is finished. A pending card would spin forever. */
  it('marks every replayed action done, never pending', () => {
    const turns = primeTranscriptToConversation([
      userMessage('go'),
      assistant([], '', [{ id: 't1', tool: 'read', path: 'a.md' }]),
    ])

    expect(turns[0].actions.every((action) => action.status === 'done')).toBe(true)
  })

  it('keeps thinking blocks as collapsible reasoning', () => {
    const turns = primeTranscriptToConversation([
      userMessage('think'),
      assistant([
        { type: 'thinking', thinking: 'weighing options' },
        { type: 'text', text: 'done' },
      ], 'done'),
    ])

    expect(turns[0].reasoning).toBe('weighing options')
    expect(turns[0].reasoningDone).toBe(true)
    expect(turns[0].response).toBe('done')
  })

  /** The summary is the only surviving record of what it replaced. */
  it('renders a compaction as its summary, not a bare divider', () => {
    const turns = primeTranscriptToConversation([
      { kind: 'compaction', id: 'c1', summary: '## Goal\nShip the session list', tokensBefore: 120000 },
      userMessage('carry on'),
    ])

    expect(turns[0].localMarker).toBe(
      'Compacted this conversation · 120000 tokens before\nGoal',
    )
    expect(turns[0].response).toBeUndefined()
    expect(turns[1].userMessage).toBe('carry on')
  })

  it('names the model a model change switched to', () => {
    const turns = primeTranscriptToConversation([
      { kind: 'modelChange', id: 'm1', provider: 'xai', modelId: 'grok-4.5' },
    ])

    expect(turns[0].localMarker).toBe('Model changed · xai / grok-4.5')
  })

  /**
   * After a compaction a log legitimately opens mid-conversation. Dropping a
   * leading assistant message would make the session look like it began later
   * than it did.
   */
  it('keeps an assistant message that has no preceding user message', () => {
    const turns = primeTranscriptToConversation([
      assistant([{ type: 'text', text: 'picking up where we left off' }], 'picking up where we left off'),
    ])

    expect(turns).toHaveLength(1)
    expect(turns[0].userMessage).toBe('')
    expect(turns[0].response).toBe('picking up where we left off')
  })

  it('does not duplicate the compaction summary from its compactionSummary message', () => {
    const turns = primeTranscriptToConversation([
      { kind: 'compaction', id: 'c1', summary: 'prior work' },
      { kind: 'message', id: 'm', message: { role: 'compactionSummary', content: null, text: '' } },
    ])

    expect(turns).toHaveLength(1)
  })

  it('ignores toolResult and custom roles, whose effect is already on the cards', () => {
    const turns = primeTranscriptToConversation([
      userMessage('go'),
      assistant([], '', [{ id: 't1', tool: 'read' }]),
      { kind: 'message', id: 'r', message: { role: 'toolResult', content: [], text: 'file body' } },
      { kind: 'message', id: 'c', message: { role: 'custom', content: [], text: 'state' } },
    ])

    expect(turns).toHaveLength(1)
    expect(turns[0].response).toBeUndefined()
  })

  /**
   * `fork` addresses entries by Prime's id, and only replayed turns have one —
   * the live stream reports no entry ids at all. Carrying it is what makes the
   * fork button possible; losing it would silently disable the feature.
   */
  it('carries the Prime entry id so a turn can be forked from', () => {
    const turns = primeTranscriptToConversation([userMessage('branch here', 'entry-7')])

    expect(turns[0].primeEntryId).toBe('entry-7')
  })

  it('leaves primeEntryId unset when the log entry had no id', () => {
    const turns = primeTranscriptToConversation([
      { kind: 'message', message: { role: 'user', content: [], text: 'no id' } },
    ])

    expect(turns[0].primeEntryId).toBeUndefined()
  })

  it('renders a fork as a branch marker, not a turn', () => {
    const turns = primeTranscriptToConversation([
      { kind: 'branchSummary', id: 'br1', fromId: 'u1', summary: 'tried the rust rewrite' },
    ])
    expect(turns[0].localMarker).toBe('Branched from this conversation\ntried the rust rewrite')
  })

  it('returns nothing for an empty transcript', () => {
    expect(primeTranscriptToConversation([])).toEqual([])
  })

  it('keeps only the ancestry of the live leaf when the log has a fork', () => {
    const kept = transcriptAlongBranch(
      [
        { kind: 'message', id: 'u1', message: { role: 'user', content: [], text: 'start' } },
        { kind: 'message', id: 'a1', parentId: 'u1', message: { role: 'assistant', content: [], text: 'ok' } },
        { kind: 'message', id: 'ts', parentId: 'a1', message: { role: 'user', content: [], text: 'typescript' } },
        { kind: 'message', id: 'rust', parentId: 'a1', message: { role: 'user', content: [], text: 'rust' } },
      ],
      'rust',
    )

    expect(kept.map((item) => item.id)).toEqual(['u1', 'a1', 'rust'])
  })
})
