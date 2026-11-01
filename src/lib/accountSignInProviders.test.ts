import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
  accountSignInProvider,
  CHATGPT_ACCOUNT_PROVIDER_ID,
  OPENAI_API_V1,
  chatgptOfficialHostConfigured,
  normalizeOauthSignInProvider,
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

  it('normalizes open_ai to openai for oauth.signIn', () => {
    expect(normalizeOauthSignInProvider('open_ai')).toBe('openai')
    expect(normalizeOauthSignInProvider('OpenAI')).toBe('openai')
    expect(normalizeOauthSignInProvider('')).toBe('openai')
    expect(normalizeOauthSignInProvider('xai')).toBe('xai')
  })

  it('treats missing OpenAI rows as official and rejects edited hosts', () => {
    expect(chatgptOfficialHostConfigured([])).toBe(true)
    expect(chatgptOfficialHostConfigured([
      { id: 'openai', kind: 'open_ai', base_url: OPENAI_API_V1 },
    ])).toBe(true)
    expect(chatgptOfficialHostConfigured([
      { id: 'openai', kind: 'open_ai', base_url: 'https://proxy.example/v1' },
    ])).toBe(false)
  })
})
