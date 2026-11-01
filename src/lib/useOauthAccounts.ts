import { useCallback, useEffect, useState } from 'react'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
  CHATGPT_ACCOUNT_PROVIDER_ID,
  normalizeOauthSignInProvider,
} from './accountSignInProviders'
import {
  cancelOauthSignIn,
  fetchOauthStatus,
  oauthAccountReady,
  SIGNED_OUT_OAUTH,
  signOutOauth,
  startOauthSignIn,
  type OauthStatus,
} from './providerOauth'

export type OauthByProvider = Record<string, OauthStatus>

export function useOauthAccounts() {
  const [oauthByProvider, setOauthByProvider] = useState<OauthByProvider>({})
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [errorByProvider, setErrorByProvider] = useState<Record<string, string>>({})
  const [signingIn, setSigningIn] = useState(false)

  const refresh = useCallback(async () => {
    const next: OauthByProvider = {}
    await Promise.all(
      ACCOUNT_SIGN_IN_PROVIDERS.map(async (account) => {
        try {
          next[account.id] = await fetchOauthStatus(account.id)
        } catch {
          next[account.id] = { ...SIGNED_OUT_OAUTH, provider: account.id }
        }
      }),
    )
    setOauthByProvider(next)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (provider = CHATGPT_ACCOUNT_PROVIDER_ID) => {
    const id = normalizeOauthSignInProvider(provider)
    setBusyProvider(id)
    setSigningIn(true)
    setErrorByProvider((current) => ({ ...current, [id]: '' }))
    try {
      const status = await startOauthSignIn(id)
      setOauthByProvider((current) => ({ ...current, [id]: status }))
      return status
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorByProvider((current) => ({ ...current, [id]: message || 'Sign in failed' }))
      await refresh()
      return null
    } finally {
      setBusyProvider(null)
      setSigningIn(false)
    }
  }, [refresh])

  const signOut = useCallback(async (provider = CHATGPT_ACCOUNT_PROVIDER_ID) => {
    setBusyProvider(provider)
    setErrorByProvider((current) => ({ ...current, [provider]: '' }))
    try {
      const status = await signOutOauth(provider)
      setOauthByProvider((current) => ({ ...current, [provider]: status }))
      return status
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorByProvider((current) => ({ ...current, [provider]: message || 'Sign out failed' }))
      await refresh()
      return null
    } finally {
      setBusyProvider(null)
    }
  }, [refresh])

  const cancel = useCallback(async () => {
    try {
      await cancelOauthSignIn()
    } finally {
      setSigningIn(false)
      setBusyProvider(null)
      await refresh()
    }
  }, [refresh])

  const chatgptReady = oauthAccountReady(oauthByProvider[CHATGPT_ACCOUNT_PROVIDER_ID])

  return {
    oauthByProvider,
    busyProvider,
    errorByProvider,
    signingIn,
    chatgptReady,
    refresh,
    signIn,
    signOut,
    cancel,
  }
}

export type OauthAccounts = ReturnType<typeof useOauthAccounts>
