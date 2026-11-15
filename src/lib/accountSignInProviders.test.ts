import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_SIGN_IN_PROVIDERS,
  accountHostConfigured,
  accountSignInProvider,
  CHATGPT_ACCOUNT_PROVIDER_ID,
  OPENAI_API_V1,
  chatgptOfficialHostConfigured,
  normalizeOauthSignInProvider,
  providerAllowsChatgptSignIn,
  xaiAccountProviderRow,
} from './accountSignInProviders'
import { providerPresetById } from './providerPresets'

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

describe('xAI account', () => {
  it('lists xAI after ChatGPT and never lists Claude', () => {
    expect(ACCOUNT_SIGN_IN_PROVIDERS.map((entry) => entry.id)).toEqual(['openai', 'xai'])
    expect(normalizeOauthSignInProvider('XAI')).toBe('xai')
  })

  it('matches the xAI preset so an API key can use the same row', () => {
    const row = xaiAccountProviderRow()
    const preset = providerPresetById('xai')
    expect(row.base_url).toBe(preset?.baseUrl)
    expect(row.models[0].id).toBe(preset?.modelId)
    expect(row.api_key_storage).toBe('local_file')
  })

  it('accepts only the official host', () => {
    expect(accountHostConfigured('xai', [])).toBe(true)
    expect(accountHostConfigured('xai', [{ id: 'xai', base_url: 'https://api.x.ai/v1/' }])).toBe(true)
    expect(accountHostConfigured('xai', [{ id: 'xai', base_url: 'https://evil.example/v1' }])).toBe(false)
  })
})
