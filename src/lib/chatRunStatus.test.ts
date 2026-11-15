import { describe, expect, it } from 'vitest'
import {
  CHATGPT_SIGN_IN_EXPIRED,
  chatRunActivityKey,
  chatRunFailure,
  chatRunFailureFromReply,
  ENGINE_DID_NOT_START,
  isChatgptAccountTarget,
  PROVIDER_SIGN_IN_NEEDED,
  chatRunStatus,
  QUIET_AFTER_MS,
  runningToolLabel,
} from './chatRunStatus'
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
      failure: chatRunFailure('Worker binary missing'),
    })).toEqual({
      state: 'failed',
      label: ENGINE_DID_NOT_START,
      action: { kind: 'retry', label: 'Retry' },
      copyText: 'Worker binary missing',
    })
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
      .toEqual({ state: 'tool', label: 'Running command' })
  })

  it('adds the elapsed time to a tool that runs for 5 seconds or more', () => {
    const tools = [{ id: 'a', name: 'bash', status: 'pending' as const }]
    expect(chatRunStatus({ snapshot: snapshot({ tools }), quietMs: 0, toolElapsedMs: 42_400 }))
      .toEqual({ state: 'tool', label: 'Running command', detail: '42s' })
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
      .toEqual({ state: 'quiet', label: 'No response for 47 seconds', action: { kind: 'stop', label: 'Stop' } })
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
    })).toEqual({
      state: 'capped',
      label: 'Paused at the step limit',
      action: { kind: 'continue', label: 'Continue for 50 more steps' },
    })
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

  it('ignores a local marker after the latest turn', () => {
    const turn = { response: 'One' }
    const marker = { localMarker: 'Model changed' }
    expect(chatRunActivityKey([turn, marker])).toBe(chatRunActivityKey([turn]))
    expect(chatRunActivityKey([{ response: 'One two' }, marker])).not.toBe(chatRunActivityKey([turn, marker]))
  })

  it('reads the last turn only', () => {
    const last = { response: 'now' }
    expect(chatRunActivityKey([{ response: 'old' }, last])).toBe(chatRunActivityKey([{ response: 'other' }, last]))
  })
})

describe('chatRunFailure', () => {
  const chatgpt = { chatgptTarget: true }

  it('leads an expired or missing ChatGPT sign-in with its cause on the ChatGPT target', () => {
    for (const reason of ['Sign in again', 'Error: Sign in again', 'openai: Sign in again', 'Not signed in to ChatGPT']) {
      expect(chatRunFailure(reason, chatgpt)).toEqual({ kind: 'chatgpt_sign_in', label: CHATGPT_SIGN_IN_EXPIRED, cause: reason.replace(/^Error:\s*/u, '') })
    }
    expect(chatRunFailure('Sign in with ChatGPT is not usable.')?.kind).toBe('chatgpt_sign_in')
  })

  it('gives a generic sign-in cause when the target is not the ChatGPT account', () => {
    for (const reason of ['anthropic: not signed in', 'Sign in again']) {
      const failure = chatRunFailure(reason)
      expect(failure).toEqual({ kind: 'sign_in', label: PROVIDER_SIGN_IN_NEEDED, cause: reason })
      expect(failure?.label).not.toMatch(/ChatGPT/u)
    }
  })

  it('says the engine did not start and keeps the host words as the cause', () => {
    const failure = chatRunFailure('Error: The Prime worker exited before it started: rhizome-worker not found.')
    expect(failure).toEqual({
      kind: 'engine',
      label: ENGINE_DID_NOT_START,
      cause: 'The Prime worker exited before it started: rhizome-worker not found.',
    })
    expect(failure?.label).not.toMatch(/prime/iu)
    expect(chatRunFailure('Sign in with ChatGPT is turned off.')?.kind).toBe('engine')
    expect(chatRunFailure('  ')).toBeNull()
  })

  it('reads the failure from a reply', () => {
    expect(chatRunFailureFromReply('Partial text\n\nError: Sign in again', { chatgptTarget: true })?.kind).toBe('chatgpt_sign_in')
    expect(chatRunFailureFromReply('Partial text\n\nError: Sign in again')?.kind).toBe('sign_in')
    expect(chatRunFailureFromReply('Error: worker-failed: Worker binary missing')).toMatchObject({ kind: 'engine', cause: 'Worker binary missing' })
    expect(chatRunFailureFromReply('Error: rate limited')).toBeNull()
  })
})

describe('isChatgptAccountTarget', () => {
  it('matches the built-in OpenAI row only', () => {
    expect(isChatgptAccountTarget('openai/gpt-5')).toBe(true)
    expect(isChatgptAccountTarget('open_ai/gpt-5')).toBe(true)
    expect(isChatgptAccountTarget('anthropic/claude')).toBe(false)
    expect(isChatgptAccountTarget('work-openai/gpt-5')).toBe(false)
    expect(isChatgptAccountTarget(null)).toBe(false)
  })
})

describe('runningToolLabel', () => {
  it('uses the approval card names in the progressive form', () => {
    expect(runningToolLabel('bash')).toBe('Running command')
    expect(runningToolLabel('edit_file')).toBe('Editing file')
    expect(runningToolLabel('get_note')).toBe('Running get_note')
  })
})
