import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
  accountSignInProvider,
  CHATGPT_ACCOUNT_PROVIDER_ID,
  OPENAI_API_V1,
  providerAllowsChatgptSignIn,
} from './accountSignInProviders'

describe('accountSignInProviders', () => {
  it('lists ChatGPT first and leaves room for later accounts', () => {
    expect(ACCOUNT_SIGN_IN_PROVIDERS[0]?.id).toBe(CHATGPT_ACCOUNT_PROVIDER_ID)
    expect(ACCOUNT_SIGN_IN_PROVIDERS[0]?.label).toBe('ChatGPT')
    expect(accountSignInProvider('openai')?.signInLabel).toBe('Sign in with ChatGPT')
  })

  it('allows sign-in only on the official OpenAI host', () => {
    expect(providerAllowsChatgptSignIn({ kind: 'open_ai', id: 'openai', baseUrl: OPENAI_API_V1 })).toBe(true)
    expect(providerAllowsChatgptSignIn({ kind: 'open_ai', id: 'open_ai', baseUrl: null })).toBe(true)
    expect(providerAllowsChatgptSignIn({
      kind: 'open_ai',
      id: 'openai',
      baseUrl: 'https://evil.example/v1',
    })).toBe(false)
    expect(providerAllowsChatgptSignIn({ kind: 'open_ai_compatible', id: 'openai', baseUrl: OPENAI_API_V1 })).toBe(false)
  })
})
