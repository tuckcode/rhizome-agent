import { describe, expect, it } from 'vitest'
import { primeProviderLabel } from './primeProviderLabels'

describe('primeProviderLabel', () => {
  it('uses the Prime provider display-name map', () => {
    expect(primeProviderLabel('nous-portal')).toBe('Nous Portal')
    expect(primeProviderLabel('xai')).toBe('xAI (Grok)')
    expect(primeProviderLabel('openai-codex')).toBe('ChatGPT (Codex)')
    expect(primeProviderLabel('anthropic')).toBe('Anthropic')
    expect(primeProviderLabel('mock')).toBe('Mock')
  })

  it('falls back to the raw id for an unknown provider', () => {
    expect(primeProviderLabel('some-new-host')).toBe('some-new-host')
    expect(primeProviderLabel('Work OpenAI')).toBe('Work OpenAI')
  })
})
