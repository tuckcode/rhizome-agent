import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrimeSessionSwitcher } from './usePrimeSessionSwitcher'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'read_prime_session_transcript') return Promise.resolve([])
    if (cmd === 'switch_prime_session') return Promise.resolve('ok')
    return Promise.resolve(null)
  },
}))

describe('usePrimeSessionSwitcher', () => {
  const agent = { replaceMessages: vi.fn() }
  const refreshSessionTree = vi.fn()

  beforeEach(() => {
    invoked.calls = []
    agent.replaceMessages.mockReset()
    refreshSessionTree.mockReset()
  })

  it('does not re-ensure the Prime host when Chat already has it running', async () => {
    const { result } = renderHook(() => usePrimeSessionSwitcher({
      agent: agent as never,
      locale: 'en',
      vaultPath: '/vault',
      sessionsAutoCollapsed: false,
      refreshSessionTree,
      primeHostSessionPath: '/live.jsonl',
      hostRunning: true,
    }))

    await act(async () => {
      await result.current.handleSelectSession({ id: 'past', path: '/past.jsonl' })
    })

    expect(invoked.calls.map((call) => call.cmd)).toEqual([
      'switch_prime_session',
      'read_prime_session_transcript',
    ])
  })

  it('still ensures the host when Chat has not connected yet', async () => {
    const { result } = renderHook(() => usePrimeSessionSwitcher({
      agent: agent as never,
      locale: 'en',
      vaultPath: '/vault',
      sessionsAutoCollapsed: false,
      refreshSessionTree,
      primeHostSessionPath: null,
      hostRunning: false,
    }))

    await act(async () => {
      await result.current.handleSelectSession({ id: 'past', path: '/past.jsonl' })
    })

    expect(invoked.calls.map((call) => call.cmd)[0]).toBe('ensure_prime_session_host')
  })
})
