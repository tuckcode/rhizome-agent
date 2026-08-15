import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoked = vi.hoisted(() => ({
  calls: [] as Array<{ cmd: string; args?: Record<string, unknown> }>,
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => {
    invoked.calls.push({ cmd, args })
    if (cmd === 'get_prime_session_host_status') {
      return Promise.resolve({
        installed: true,
        version: '1',
        running: true,
        sessionId: 'sess-1',
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
})
