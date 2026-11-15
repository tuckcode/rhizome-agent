import { describe, expect, it } from 'vitest'
import { chatRunActivityKey, chatRunStatus, QUIET_AFTER_MS } from './chatRunStatus'
import type { ChatRunSnapshot } from './chatRunLiveStatus'

function snapshot(extra: Partial<ChatRunSnapshot> = {}): ChatRunSnapshot {
  return { isActive: true, hasResponse: false, tools: [], ...extra }
}

describe('chatRunStatus', () => {
  it('says nothing when no run is active', () => {
    expect(chatRunStatus({ snapshot: snapshot({ isActive: false }), quietMs: 0 }))
      .toEqual({ state: 'idle', label: '' })
  })

  it('reports a start failure before any other state', () => {
    expect(chatRunStatus({
      snapshot: snapshot({ isActive: false }),
      quietMs: 0,
      failureReason: 'Sign in again',
    })).toEqual({ state: 'failed', label: 'Sign in again' })
  })

  it('says Thinking before the first text arrives', () => {
    expect(chatRunStatus({ snapshot: snapshot(), quietMs: 1200 }))
      .toEqual({ state: 'thinking', label: 'Thinking' })
  })

  it('says Writing while reply text arrives', () => {
    expect(chatRunStatus({ snapshot: snapshot({ hasResponse: true }), quietMs: 300 }))
      .toEqual({ state: 'writing', label: 'Writing' })
  })

  it('names the tool that runs', () => {
    const tools = [{ id: 'a', name: 'bash', status: 'pending' as const }]
    expect(chatRunStatus({ snapshot: snapshot({ tools }), quietMs: 900 }))
      .toEqual({ state: 'tool', label: 'Running bash' })
  })

  it('adds the elapsed time to a tool that runs for 5 seconds or more', () => {
    const tools = [{ id: 'a', name: 'bash', status: 'pending' as const }]
    expect(chatRunStatus({ snapshot: snapshot({ tools }), quietMs: 42_400 }))
      .toEqual({ state: 'tool', label: 'Running bash', detail: '42s' })
  })

  it('counts the tools when more than one runs', () => {
    const tools = [
      { id: 'a', name: 'read_file', status: 'pending' as const },
      { id: 'b', name: 'grep', status: 'pending' as const },
      { id: 'c', name: 'bash', status: 'done' as const },
    ]
    expect(chatRunStatus({ snapshot: snapshot({ tools }), quietMs: 0 }).label)
      .toBe('Running 2 tools')
  })

  it('puts a wait for approval before a tool that runs', () => {
    const tools = [
      { id: 'a', name: 'read_file', status: 'pending' as const },
      { id: 'b', name: 'bash', status: 'pending' as const, needsApproval: true },
    ]
    expect(chatRunStatus({ snapshot: snapshot({ tools }), quietMs: 90_000 }))
      .toEqual({ state: 'approval', label: 'Waiting for your approval' })
  })

  it('counts the approvals when more than one waits', () => {
    const tools = [
      { id: 'a', name: 'bash', status: 'pending' as const, needsApproval: true },
      { id: 'b', name: 'bash', status: 'pending' as const, needsApproval: true },
    ]
    expect(chatRunStatus({ snapshot: snapshot({ tools }), quietMs: 0 }).label)
      .toBe('Waiting for 2 approvals')
  })

  it('reports no response after 30 seconds with no event and no tool', () => {
    expect(chatRunStatus({ snapshot: snapshot({ hasResponse: true }), quietMs: QUIET_AFTER_MS - 1 }).state)
      .toBe('writing')
    expect(chatRunStatus({ snapshot: snapshot({ hasResponse: true }), quietMs: 47_900 }))
      .toEqual({ state: 'quiet', label: 'No response for 47 seconds' })
  })

  it('reports minutes after 60 seconds with no response', () => {
    expect(chatRunStatus({ snapshot: snapshot(), quietMs: 125_000 }).label)
      .toBe('No response for 2 minutes')
    expect(chatRunStatus({ snapshot: snapshot(), quietMs: 61_000 }).label)
      .toBe('No response for 1 minute')
  })

  it('reports a pause at the step limit after the run stops', () => {
    expect(chatRunStatus({
      snapshot: snapshot({ isActive: false, capped: { steps: 50, max_steps: 50 } }),
      quietMs: 0,
    })).toEqual({ state: 'capped', label: 'Paused at the step limit' })
  })
})

describe('chatRunActivityKey', () => {
  it('changes when text, reasoning or a tool status changes', () => {
    const base = [{ response: 'a', reasoning: 'r', actions: [{ tool: 'bash', toolId: '1', status: 'pending' }] }]
    const key = chatRunActivityKey(base)
    expect(chatRunActivityKey([{ ...base[0], response: 'ab' }])).not.toBe(key)
    expect(chatRunActivityKey([{ ...base[0], reasoning: 'rr' }])).not.toBe(key)
    expect(chatRunActivityKey([{ ...base[0], actions: [{ tool: 'bash', toolId: '1', status: 'done' }] }]))
      .not.toBe(key)
    expect(chatRunActivityKey([{ ...base[0] }])).toBe(key)
  })

  it('reads the last turn only', () => {
    const last = { response: 'now' }
    expect(chatRunActivityKey([{ response: 'old' }, last])).toBe(chatRunActivityKey([{ response: 'other' }, last]))
  })
})
