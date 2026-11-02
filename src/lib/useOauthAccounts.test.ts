import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const host = vi.hoisted(() => ({
  callHost: vi.fn(),
}))

vi.mock('./callHost', () => ({
  callHost: host.callHost,
}))

import { useOauthAccounts } from './useOauthAccounts'

const signedOut = {
  provider: 'openai',
  enabled: false,
  signed_in: false,
  usable: false,
  email: null,
  revoked: true,
}

describe('useOauthAccounts cancel', () => {
  beforeEach(() => {
    host.callHost.mockReset()
  })

  it('clears errorByProvider for the busy provider when cancel runs', async () => {
    let resolveSignIn: ((value: unknown) => void) | null = null

    host.callHost.mockImplementation(async (cmd: string) => {
      if (cmd === 'oauth_status') return { ...signedOut }
      if (cmd === 'oauth_cancel') return null
      if (cmd === 'oauth_sign_in') throw new Error('browser closed')
      return signedOut
    })

    const { result } = renderHook(() => useOauthAccounts())
    await waitFor(() => expect(result.current.oauthByProvider.openai).toBeDefined())

    await act(async () => {
      await result.current.signIn('openai')
    })
    expect(result.current.errorByProvider.openai).toBe('browser closed')

    host.callHost.mockImplementation(async (cmd: string) => {
      if (cmd === 'oauth_status') return { ...signedOut }
      if (cmd === 'oauth_cancel') return null
      if (cmd === 'oauth_sign_in') {
        return await new Promise((resolve) => {
          resolveSignIn = resolve
        })
      }
      return signedOut
    })

    let signInPromise!: Promise<unknown>
    act(() => {
      signInPromise = result.current.signIn('openai')
    })
    await waitFor(() => expect(result.current.busyProvider).toBe('openai'))

    await act(async () => {
      await result.current.cancel()
    })

    expect(result.current.errorByProvider.openai).toBe('')
    expect(result.current.busyProvider).toBeNull()
    expect(result.current.signingIn).toBe(false)

    await act(async () => {
      resolveSignIn?.({ ...signedOut })
      await signInPromise
    })
  })
})
