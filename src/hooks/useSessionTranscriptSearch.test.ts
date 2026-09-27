import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callHost, trackEvent } = vi.hoisted(() => ({
  callHost: vi.fn(),
  trackEvent: vi.fn(),
}))

vi.mock('../lib/callHost', () => ({
  callHost: (...args: unknown[]) => callHost(...args),
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}))

import { useSessionTranscriptSearch } from './useSessionTranscriptSearch'

const transcript = [
  {
    kind: 'message',
    message: { role: 'user', content: [], text: 'named socket' },
  },
]

beforeEach(() => {
  callHost.mockReset()
  trackEvent.mockReset()
  callHost.mockImplementation(async (command: string) => {
    if (command === 'list_prime_session_summaries') {
      return [{ id: 'a', path: '/sessions/a.jsonl', title: 'Socket', mtimeMs: 5 }]
    }
    if (command === 'read_prime_session_transcript') return transcript
    return []
  })
})

describe('useSessionTranscriptSearch', () => {
  it('records a hit count without the query or the session path', async () => {
    const { rerender } = renderHook(
      ({ query }) => useSessionTranscriptSearch(query, true),
      { initialProps: { query: 'socket' } },
    )

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith('session_transcript_search', { hit_count: 1 })
    }, { timeout: 2000 })

    const properties = trackEvent.mock.calls[0]?.[1] as Record<string, unknown>
    expect(properties).not.toHaveProperty('query')
    expect(JSON.stringify(properties)).not.toContain('/sessions')
    expect(JSON.stringify(properties)).not.toContain('socket')

    const reads = () => callHost.mock.calls.filter((call) => call[0] === 'read_prime_session_transcript')
    expect(reads()).toHaveLength(1)
    expect(callHost).toHaveBeenCalledWith('list_prime_session_summaries')
    expect(callHost).toHaveBeenCalledWith('read_prime_session_transcript', { path: '/sessions/a.jsonl' })

    rerender({ query: 'named' })
    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(2), { timeout: 2000 })
    expect(reads()).toHaveLength(1)
  })
})
