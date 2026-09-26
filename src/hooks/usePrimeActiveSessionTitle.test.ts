import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as string[],
  sessions: [] as Array<{ id: string; path: string; title?: string | null }>,
  returnsNull: false,
}))

vi.mock('../lib/callHost', () => ({
  callHostOr: (cmd: string, fallback: unknown) => {
    invoked.calls.push(cmd)
    if (invoked.returnsNull) return Promise.resolve(null)
    return Promise.resolve(invoked.sessions.length > 0 ? invoked.sessions : fallback)
  },
}))

import { usePrimeActiveSessionTitle } from './usePrimeActiveSessionTitle'

describe('usePrimeActiveSessionTitle', () => {
  beforeEach(() => {
    invoked.calls = []
    invoked.sessions = []
    invoked.returnsNull = false
  })

  it('treats a host that answers null as no sessions, without throwing', async () => {
    // App.test's host mock answers null; `.find` on it was an unhandled
    // rejection that failed the push gate's coverage lane.
    invoked.returnsNull = true
    const { result } = renderHook(() => usePrimeActiveSessionTitle('/mock/sessions/a.jsonl'))
    await waitFor(() => expect(invoked.calls).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current).toBeNull()
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

  it('re-reads when a turn ends, so a new chat picks up its first title', async () => {
    invoked.sessions = [{ id: 'a', path: '/mock/sessions/a.jsonl', title: null }]
    const { result, rerender } = renderHook(
      ({ streaming }) => usePrimeActiveSessionTitle('/mock/sessions/a.jsonl', streaming),
      { initialProps: { streaming: true } },
    )
    await waitFor(() => expect(invoked.calls).toHaveLength(1))
    expect(result.current).toBeNull()

    invoked.sessions = [{ id: 'a', path: '/mock/sessions/a.jsonl', title: 'Plan the launch' }]
    rerender({ streaming: false })

    await waitFor(() => expect(result.current).toBe('Plan the launch'))
  })

  it('never shows the previous session title after a switch', async () => {
    invoked.sessions = [
      { id: 'a', path: '/mock/sessions/a.jsonl', title: 'Old chat' },
      { id: 'b', path: '/mock/sessions/b.jsonl', title: 'New chat title' },
    ]
    const { result, rerender } = renderHook(
      ({ path }) => usePrimeActiveSessionTitle(path),
      { initialProps: { path: '/mock/sessions/a.jsonl' } },
    )
    await waitFor(() => expect(result.current).toBe('Old chat'))

    rerender({ path: '/mock/sessions/b.jsonl' })
    // Synchronously after the switch, before the new read resolves.
    expect(result.current).not.toBe('Old chat')
    await waitFor(() => expect(result.current).toBe('New chat title'))
  })
})
