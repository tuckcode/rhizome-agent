import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as string[],
  sessions: [] as Array<{ id: string; path: string; title?: string | null }>,
}))

vi.mock('../lib/callHost', () => ({
  callHostOr: (cmd: string, fallback: unknown) => {
    invoked.calls.push(cmd)
    return Promise.resolve(invoked.sessions.length > 0 ? invoked.sessions : fallback)
  },
}))

import { usePrimeActiveSessionTitle } from './usePrimeActiveSessionTitle'

describe('usePrimeActiveSessionTitle', () => {
  beforeEach(() => {
    invoked.calls = []
    invoked.sessions = []
  })

  it('is null with no attached session, and never calls the host', () => {
    const { result } = renderHook(() => usePrimeActiveSessionTitle(null))

    expect(result.current).toBeNull()
    expect(invoked.calls).toEqual([])
  })

  it('resolves the title of the session matching the given path', async () => {
    invoked.sessions = [
      { id: 'a', path: '/mock/sessions/a.jsonl', title: 'Other session' },
      { id: 'b', path: '/mock/sessions/b.jsonl', title: 'Fix the login bug' },
    ]

    const { result } = renderHook(() => usePrimeActiveSessionTitle('/mock/sessions/b.jsonl'))

    await waitFor(() => {
      expect(result.current).toBe('Fix the login bug')
    })
    expect(invoked.calls).toEqual(['list_prime_session_summaries'])
  })

  it('is null when no session matches the given path', async () => {
    invoked.sessions = [{ id: 'a', path: '/mock/sessions/a.jsonl', title: 'Other session' }]

    const { result } = renderHook(() => usePrimeActiveSessionTitle('/mock/sessions/missing.jsonl'))

    await waitFor(() => {
      expect(invoked.calls).toEqual(['list_prime_session_summaries'])
    })
    expect(result.current).toBeNull()
  })

  it('is null when the matched session has no title', async () => {
    invoked.sessions = [{ id: 'a', path: '/mock/sessions/a.jsonl', title: '   ' }]

    const { result } = renderHook(() => usePrimeActiveSessionTitle('/mock/sessions/a.jsonl'))

    await waitFor(() => {
      expect(invoked.calls).toEqual(['list_prime_session_summaries'])
    })
    expect(result.current).toBeNull()
  })
})
