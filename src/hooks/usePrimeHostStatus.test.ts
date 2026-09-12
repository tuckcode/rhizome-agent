import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  running: true,
  problem: null as { code: string } | null,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_prime_session_host_status') {
      return Promise.resolve({
        installed: true,
        version: '1',
        running: invoked.running,
        sessionId: invoked.running ? 'sess-1' : null,
        isStreaming: false,
        binaryPath: '/bin/prime',
        modelName: 'Grok 4.5',
        modelId: 'grok-4.5',
        modelProvider: 'xai',
        problem: invoked.problem,
      })
    }
    return Promise.resolve('sess-1')
  },
}))

import { usePrimeHostStatus } from './usePrimeHostStatus'

describe('usePrimeHostStatus', () => {
  beforeEach(() => {
    invoked.calls = []
    invoked.running = true
    invoked.problem = null
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  it('starts the Prime host when a vault is attached', async () => {
    renderHook(() => usePrimeHostStatus(true, '/Users/dtc/Documents/Rhizome Vault'))

    await waitFor(() => {
      expect(invoked.calls[0]).toEqual({
        cmd: 'ensure_prime_session_host',
        args: { vaultPath: '/Users/dtc/Documents/Rhizome Vault' },
      })
    })
  })

  it('does not restart Prime while the window is hidden', async () => {
    invoked.running = false
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })

    renderHook(() => usePrimeHostStatus(true, '/Users/dtc/Documents/Rhizome Vault'))
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(
      invoked.calls.filter((call) => call.cmd === 'ensure_prime_session_host'),
    ).toHaveLength(0)
  })

  /**
   * Test builds often lose the first connect: the window is up before Prime's
   * service is listening. Status-only polling then froze the model chip for
   * the rest of the session. A down host has to be retried, not observed.
   */
  it('reconnects when a status poll finds the host down', async () => {
    invoked.running = false
    renderHook(() => usePrimeHostStatus(true, '/Users/dtc/Documents/Rhizome Vault'))

    await waitFor(() => {
      const ensures = invoked.calls.filter((call) => call.cmd === 'ensure_prime_session_host')
      expect(ensures.length).toBeGreaterThanOrEqual(2)
    })
  })

  /**
   * C64: at launch the window is up before Prime's service is listening, so the
   * first poll can answer `not_installed` for an engine that is only still
   * starting. Showing that instructs the user to install software they already
   * have, seconds before the strip corrects itself.
   */
  it('withholds a first problem report while the engine may still be starting', async () => {
    invoked.running = false
    invoked.problem = { code: 'not_installed' }

    const { result } = renderHook(() => usePrimeHostStatus(true, '/vault'))

    await waitFor(() => {
      expect(invoked.calls.some((call) => call.cmd === 'get_prime_session_host_status')).toBe(true)
    })
    expect(result.current.problem).toBeNull()
  })

  it('surfaces a problem once a second poll agrees with it', async () => {
    invoked.running = false
    invoked.problem = { code: 'not_installed' }

    const { result } = renderHook(() => usePrimeHostStatus(true, '/vault'))

    await waitFor(() => {
      expect(invoked.calls.some((call) => call.cmd === 'get_prime_session_host_status')).toBe(true)
    })
    expect(result.current.problem).toBeNull()

    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      expect(result.current.problem).toEqual({ code: 'not_installed' })
    })
  })
})
