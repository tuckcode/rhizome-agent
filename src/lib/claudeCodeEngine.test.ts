import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const host = vi.hoisted(() => ({
  calls: [] as string[],
  status: { installed: true, version: '2.1.325 (Claude Code)', loggedIn: true, authMethod: 'claude.ai' } as unknown,
}))

vi.mock('./callHost', () => ({
  callHost: vi.fn(async (cmd: string) => {
    host.calls.push(cmd)
    return host.status
  }),
}))

const tracked = vi.hoisted(() => ({ events: [] as Array<[string, unknown]> }))
vi.mock('./telemetry', () => ({
  trackEvent: vi.fn((name: string, props: unknown) => {
    tracked.events.push([name, props])
  }),
}))

import {
  CLAUDE_CODE_SETTINGS_NOTES,
  CLAUDE_CODE_SWITCH_LABEL,
  claudeCodeEngineState,
  claudeCodeStatusLine,
  isClaudeCodeEngineReady,
  publishClaudeCodeEngineEnabled,
  resetClaudeCodeEngineForTests,
  trackClaudeCodeEngineSelected,
  trackClaudeCodeEngineToggled,
  useClaudeCodeEngineEnabled,
  useClaudeCodeEngineState,
} from './claudeCodeEngine'

afterEach(() => {
  resetClaudeCodeEngineForTests()
  host.calls = []
  tracked.events = []
})

describe('claudeCodeEngine', () => {
  it('says what to run in the terminal when Claude Code is signed out, and offers no sign-in', () => {
    const state = claudeCodeEngineState({ installed: true, version: '2.1.325', loggedIn: false, authMethod: null })
    expect(state.kind).toBe('signed_out')
    expect(isClaudeCodeEngineReady(state)).toBe(false)
    expect(claudeCodeStatusLine(state)).toBe(
      'Claude Code is not signed in. Run claude auth login in your terminal, then check again.',
    )
  })

  it('reports a signed-in install with its version and method only', () => {
    const state = claudeCodeEngineState({
      installed: true,
      version: '2.1.325 (Claude Code)',
      loggedIn: true,
      authMethod: 'claude.ai',
    })
    expect(isClaudeCodeEngineReady(state)).toBe(true)
    expect(claudeCodeStatusLine(state)).toBe('Claude Code 2.1.325 is signed in with claude.ai.')
  })

  it('leaves an unreadable sign-in state to Claude Code and says so', () => {
    const state = claudeCodeEngineState({ installed: true, version: null, loggedIn: null, authMethod: null })
    expect(isClaudeCodeEngineReady(state)).toBe(true)
    expect(claudeCodeStatusLine(state)).toBe(
      'Claude Code is installed. Rhizome could not read whether it is signed in.',
    )
  })

  it('is not ready when Claude Code is missing or still being checked', () => {
    expect(isClaudeCodeEngineReady(claudeCodeEngineState(null))).toBe(false)
    const missing = claudeCodeEngineState({ installed: false, version: null, loggedIn: null, authMethod: null })
    expect(isClaudeCodeEngineReady(missing)).toBe(false)
    expect(claudeCodeStatusLine(missing)).toBe('Rhizome could not find or run Claude Code on this computer.')
  })

  it('carries the Settings copy from ADR-0191', () => {
    expect(CLAUDE_CODE_SWITCH_LABEL).toBe('Run chats with your installed Claude Code')
    const notes = CLAUDE_CODE_SETTINGS_NOTES.join(' ')
    expect(notes).toContain("Claude Code is Anthropic's product. Anthropic does not make or endorse Rhizome.")
    expect(notes).toContain('CLAUDE.md')
    expect(notes).toContain('allow rule or hook')
    expect(notes).toContain('never runs on Claude Code')
  })

  it('asks the host only while active and reuses the answer', async () => {
    const { result, rerender } = renderHook(({ active }) => useClaudeCodeEngineState(active), {
      initialProps: { active: false },
    })
    expect(host.calls).toEqual([])
    expect(result.current.state.kind).toBe('checking')
    rerender({ active: true })
    await waitFor(() => expect(result.current.state.kind).toBe('ready'))
    expect(host.calls).toEqual(['get_claude_code_engine_status'])
    act(() => result.current.refresh())
    await waitFor(() => expect(host.calls).toHaveLength(2))
  })

  it('shares the Settings switch with every subscriber', () => {
    const { result } = renderHook(() => useClaudeCodeEngineEnabled())
    expect(result.current).toBe(false)
    act(() => publishClaudeCodeEngineEnabled(true))
    expect(result.current).toBe(true)
  })

  it('sends no prompt, path, version or account detail to analytics', () => {
    trackClaudeCodeEngineToggled(true)
    trackClaudeCodeEngineSelected()
    expect(tracked.events).toEqual([
      ['claude_code_engine_toggled', { enabled: 'on' }],
      ['claude_code_engine_selected', {}],
    ])
  })
})
