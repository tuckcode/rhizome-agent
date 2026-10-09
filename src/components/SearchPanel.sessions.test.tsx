import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'

const { mockInvoke, trackEvent } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  mockInvoke: (...args: unknown[]) => mockInvoke(...args),
  isTauri: () => false,
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}))

import { SearchPanel } from './SearchPanel'

const entry: VaultEntry = {
  path: '/vault/essay/ai-apis.md',
  filename: 'ai-apis.md',
  title: 'How to Design AI-first APIs',
  isA: 'Essay',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: 1,
  createdAt: 1,
  fileSize: 10,
  snippet: '',
  wordCount: 1,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: false,
}

describe('SearchPanel session transcripts', () => {
  it('shows a Sessions group for a transcript hit', async () => {
    const onSelectSessionHit = vi.fn()
    const onClose = vi.fn()
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === 'list_prime_session_summaries') {
        return [{ id: 'a', path: '/sessions/a.jsonl', title: 'Socket work', mtimeMs: 4 }]
      }
      if (command === 'read_prime_session_transcript') {
        return [{
          kind: 'message',
          message: {
            role: 'assistant',
            content: [],
            text: 'The daemon transport uses a named socket.',
          },
        }]
      }
      return { results: [], elapsed_ms: 1 }
    })

    render(
      <SearchPanel
        open
        vaultPath="/vault"
        entries={[entry]}
        onSelectNote={vi.fn()}
        onSelectSessionHit={onSelectSessionHit}
        onClose={onClose}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Search in all notes...'), {
      target: { value: 'socket' },
    })

    expect(await screen.findByRole('region', { name: 'Sessions' }, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByText('Socket work')).toBeInTheDocument()
    expect(screen.getByText('The daemon transport uses a named socket.')).toBeInTheDocument()
    expect(screen.queryByText('No results found')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: /Socket work/ }))
    expect(onSelectSessionHit).toHaveBeenCalledWith(expect.objectContaining({
      sessionPath: '/sessions/a.jsonl',
      messageIndex: 0,
      role: 'assistant',
    }))
    expect(onClose).toHaveBeenCalled()

    expect(trackEvent).toHaveBeenCalledWith('session_transcript_search', { hit_count: 1 })
    const properties = trackEvent.mock.calls.find((call) => call[0] === 'session_transcript_search')?.[1]
    expect(JSON.stringify(properties)).not.toContain('socket')
    expect(JSON.stringify(properties)).not.toContain('/sessions')
  })
})
