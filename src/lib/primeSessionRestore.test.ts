import { describe, expect, it } from 'vitest'
import {
  decidePrimeSessionRestore,
  type PrimeRestoreInput,
} from './primeSessionRestore'
import type { PrimeSessionSummary } from './primeSessionMeta'

function session(overrides: Partial<PrimeSessionSummary> = {}): PrimeSessionSummary {
  return { id: 'old', path: '/sessions/old.jsonl', mtimeMs: 1, hasConversation: true, ...overrides }
}

function decide(overrides: Partial<PrimeRestoreInput> = {}) {
  return decidePrimeSessionRestore({
    enabled: true,
    native: true,
    hostRunning: true,
    hostReattached: false,
    hostSessionPath: null,
    summaries: [session({ id: 'new', path: '/sessions/new.jsonl', mtimeMs: 9 })],
    idleResumeConsumed: false,
    ...overrides,
  })
}

describe('decidePrimeSessionRestore', () => {
  it('shows the rejoined live session, not the newest disk log', () => {
    const next = decide({
      hostReattached: true,
      hostSessionPath: '/sessions/live.jsonl',
      summaries: [session({ id: 'disk', path: '/sessions/disk.jsonl', mtimeMs: 99 })],
    })
    expect(next).toEqual({ type: 'live-attach', sessionPath: '/sessions/live.jsonl' })
  })

  it('opens the last disk conversation when the host is up with no session', () => {
    const next = decide({ hostRunning: true, hostReattached: false, hostSessionPath: null })
    expect(next).toEqual({
      type: 'idle-disk',
      session: expect.objectContaining({ id: 'new', path: '/sessions/new.jsonl' }),
    })
  })

  it('does not treat a running host as an active session', () => {
    const next = decide({
      hostRunning: true,
      hostReattached: false,
      hostSessionPath: null,
      summaries: [],
    })
    expect(next).toEqual({ type: 'none' })
  })

  it('does not steal a session created this runtime', () => {
    const next = decide({
      hostRunning: true,
      hostReattached: false,
      hostSessionPath: '/sessions/fresh.jsonl',
    })
    expect(next).toEqual({ type: 'none' })
  })

  it('skips idle-disk restore in the browser mock', () => {
    expect(decide({ native: false }).type).toBe('none')
  })

  it('skips idle-disk restore when the host is down', () => {
    expect(decide({ hostRunning: false }).type).toBe('none')
  })

  it('skips idle-disk restore after New Chat this runtime', () => {
    expect(decide({ idleResumeConsumed: true }).type).toBe('none')
  })

  it('does nothing when Chat is not on Prime', () => {
    expect(decide({ enabled: false, hostReattached: true, hostSessionPath: '/sessions/live.jsonl' }).type)
      .toBe('none')
  })
})
