import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
  running: true,
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
})
