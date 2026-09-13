import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrimeSessionSwitcher } from './usePrimeSessionSwitcher'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  switchImpl: null as null | (() => Promise<string>),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'read_prime_session_transcript') return Promise.resolve([])
    if (cmd === 'switch_prime_session') {
      return invoked.switchImpl ? invoked.switchImpl() : Promise.resolve('ok')
    }
    return Promise.resolve(null)
  },
}))

describe('usePrimeSessionSwitcher', () => {
  const agent = { replaceMessages: vi.fn(), messages: [] as unknown[] }
  const refreshSessionTree = vi.fn()

  beforeEach(() => {
    invoked.calls = []
    invoked.switchImpl = null
    agent.replaceMessages.mockReset()
    agent.messages = []
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
    expect(result.current.activeSessionPath).toBe('/past.jsonl')
  })

  it('highlights the session row before the host round trip finishes', async () => {
    let finishSwitch: (() => void) | undefined
    const switchGate = new Promise<string>((resolve) => {
      finishSwitch = () => resolve('ok')
    })
    invoked.switchImpl = () => switchGate

    const { result } = renderHook(() => usePrimeSessionSwitcher({
      agent: agent as never,
      locale: 'en',
      vaultPath: '/vault',
      sessionsAutoCollapsed: false,
      refreshSessionTree,
      primeHostSessionPath: '/live.jsonl',
      hostRunning: true,
    }))

    let pending: Promise<void> | undefined
    act(() => {
      pending = result.current.handleSelectSession({ id: 'past', path: '/past.jsonl' })
    })

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.activeSessionPath).toBe('/past.jsonl')
    expect(agent.replaceMessages).toHaveBeenCalledWith([])

    await act(async () => {
      finishSwitch?.()
      await pending
    })
  })

  it('rolls the highlight back when the host refuses the switch', async () => {
    invoked.switchImpl = () => Promise.reject(new Error('still streaming'))
    const stale = [{ role: 'assistant', content: 'stale turn' }]
    agent.messages = stale

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

    expect(result.current.activeSessionPath).toBeNull()
    expect(result.current.switchError).toContain('still streaming')
    expect(agent.replaceMessages).toHaveBeenNthCalledWith(1, [])
    expect(agent.replaceMessages).toHaveBeenLastCalledWith(stale)
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
