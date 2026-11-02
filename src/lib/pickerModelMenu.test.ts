import { describe, expect, it } from 'vitest'
import {
  buildPickerMenu,
  chatProviderGroupLabel,
  pickerBlockReason,
  unsetProviderGroupCount,
  type PickerMenuModel,
} from './pickerModelMenu'

function model(overrides: Partial<PickerMenuModel> & Pick<PickerMenuModel, 'id' | 'providerName' | 'providerKind'>): PickerMenuModel {
  const providerId = overrides.providerId ?? overrides.providerKind
  return {
    modelId: overrides.modelId ?? overrides.id,
    displayName: overrides.displayName ?? overrides.modelId ?? overrides.id,
    providerId,
    cacheKey: overrides.cacheKey ?? providerId,
    baseUrl: null,
    ...overrides,
  }
}

describe('chatProviderGroupLabel', () => {
  it('uses the user name or the base URL host instead of Custom provider', () => {
    expect(chatProviderGroupLabel('Scrub test', 'open_ai_compatible', 'https://scrub.example/v1')).toBe('Scrub test')
    expect(chatProviderGroupLabel('Custom provider', 'open_ai_compatible', 'https://api.groq.com/openai/v1')).toBe('api.groq.com')
    expect(chatProviderGroupLabel('Ollama', 'ollama')).toBe('Ollama')
  })
})

describe('pickerBlockReason', () => {
  it('names the three blocked states', () => {
    expect(pickerBlockReason('Ollama', 'needs_key')).toBe('Needs an API key')
    expect(pickerBlockReason('Ollama', 'not_running')).toBe("Ollama isn't running")
    expect(pickerBlockReason('Ollama', 'no_models')).toBe('No models found')
    expect(pickerBlockReason('Ollama', 'load_failed')).toBe("Couldn't load models")
  })
})

describe('buildPickerMenu', () => {
  it('shows a Ready xAI account with its models once', () => {
    const groups = buildPickerMenu({
      models: [model({
        id: 'xai/grok-4.3',
        providerName: 'xAI',
        providerKind: 'open_ai_compatible',
        providerId: 'xai',
        modelId: 'grok-4.3',
      })],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
      oauthByProvider: {
        xai: {
          provider: 'xai',
          enabled: true,
          signed_in: true,
          usable: true,
          email: 'mock@example.com',
          revoked: true,
        },
      },
    })
    const account = groups.find((group) => group.id === 'account:xai')
    expect(account?.label).toBe('xAI (preview) · mock@example.com')
    expect(account?.rows.map((row) => row.modelId)).toEqual(['grok-4.3'])
    expect(groups.filter((group) => group.section === 'api_keys')).toEqual([])
  })

  const ollama = model({
    id: 'ollama/llama3.2',
    modelId: 'llama3.2',
    displayName: 'llama3.2',
    providerName: 'Ollama',
    providerKind: 'ollama',
  })
  const studio = model({
    id: 'lm_studio/llama3.2',
    modelId: 'llama3.2',
    displayName: 'llama3.2',
    providerName: 'LM Studio',
    providerKind: 'lm_studio',
  })
  const openai = model({
    id: 'openai/gpt-4.1-mini',
    modelId: 'gpt-4.1-mini',
    displayName: 'gpt-4.1-mini',
    providerName: 'OpenAI',
    providerKind: 'open_ai',
    providerId: 'openai',
    cacheKey: 'openai',
  })
  const free = model({
    id: 'free_tier_auto',
    modelId: 'free_tier_auto',
    displayName: 'Taproot',
    providerName: 'Free tier',
    providerKind: 'free_tier',
  })

  it('puts ChatGPT accounts first, then separate Ollama and LM Studio under Local', () => {
    const groups = buildPickerMenu({
      models: [ollama, studio],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(groups.map((group) => group.label)).toEqual(['ChatGPT', 'xAI (preview)', 'LM Studio', 'Ollama'])
    expect(groups.map((group) => group.section)).toEqual(['accounts', 'accounts', 'local', 'local'])
    expect(groups[0].accountSignIn).toBe(true)
    expect(groups.find((group) => group.label === 'Ollama')?.rows.map((row) => row.label)).toEqual([
      'llama3.2',
    ])
    expect(groups.find((group) => group.label === 'LM Studio')?.rows.map((row) => row.label)).toEqual([
      'llama3.2',
    ])
  })

  it('orders accounts → API keys → Local → Free, and sinks groups with no selectable model', () => {
    const groups = buildPickerMenu({
      models: [free, ollama, openai],
      failures: [],
      loadingNames: [],
      needsKey: (kind) => kind === 'open_ai',
    })
    expect(groups.map((group) => group.label)).toEqual(['ChatGPT', 'xAI (preview)', 'OpenAI API key', 'Ollama', 'Free tier'])
    expect(groups[1].blocked).toBe(true)
    // ChatGPT (no selectable model) sinks within accounts; OpenAI API key sinks in api_keys
    expect(groups[0].accountSignIn).toBe(true)
  })

  it('disables a keyless provider and points Add key at the API tab', () => {
    const groups = buildPickerMenu({
      models: [openai],
      failures: [],
      loadingNames: [],
      needsKey: (kind) => kind === 'open_ai',
    })
    const openAi = groups.find((group) => group.label === 'OpenAI API key')
    expect(openAi?.blocked).toBe(true)
    expect(openAi?.rows[0]).toMatchObject({
      disabled: true,
      reason: 'Needs an API key',
      action: 'add_key',
      tab: 'api',
    })
    expect(unsetProviderGroupCount(groups)).toBeGreaterThanOrEqual(1)
  })

  it('keeps Sign in on the accounts group only, not the OpenAI API key group', () => {
    const groups = buildPickerMenu({
      models: [openai],
      failures: [],
      loadingNames: [],
      needsKey: () => true,
      accountNeedsSignIn: (kind) => kind === 'open_ai',
    })
    const openAi = groups.find((group) => group.label === 'OpenAI API key')
    expect(openAi?.rows[0]).toMatchObject({ action: 'add_key' })
    expect(groups.find((group) => group.section === 'accounts')?.accountSignIn).toBe(true)
  })

  it('disables Ollama when it is not running and keeps a model row', () => {
    const groups = buildPickerMenu({
      models: [ollama],
      failures: [{ cacheKey: 'ollama', kind: 'unreachable' }],
      loadingNames: [],
      needsKey: () => false,
    })
    const local = groups.find((group) => group.label === 'Ollama')
    expect(local?.rows[0]).toMatchObject({
      disabled: true,
      reason: "Ollama isn't running",
      action: 'retry',
      tab: 'local',
      label: 'llama3.2',
    })
  })

  it('keeps saved rows selectable when the list times out or is empty', () => {
    const scrub = model({
      id: 'scrub/m',
      modelId: 'm',
      displayName: 'm',
      providerName: 'Scrub test',
      providerKind: 'open_ai_compatible',
      providerId: 'scrub',
      baseUrl: 'https://scrub.example/v1',
    })
    const loading = buildPickerMenu({
      models: [scrub],
      failures: [{ cacheKey: 'scrub', kind: 'timeout' }],
      loadingNames: ['scrub'],
      needsKey: () => false,
    })
    const scrubLoading = loading.find((group) => group.label === 'Scrub test')
    expect(scrubLoading?.rows[0].disabled).toBe(false)

    const failed = buildPickerMenu({
      models: [scrub],
      failures: [{ cacheKey: 'scrub', kind: 'timeout' }],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(failed.find((group) => group.label === 'Scrub test')?.hint).toBe("Couldn't load models")

    const empty = buildPickerMenu({
      models: [studio, ollama],
      failures: [{ cacheKey: 'lm_studio', kind: 'empty' }],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(empty.find((group) => group.label === 'LM Studio')?.hint).toBe('No models found')
    expect(empty.find((group) => group.label === 'Ollama')?.hint).toBeNull()
  })

  it('hides the catalog Custom provider seed even when the user named a host', () => {
    const custom = model({
      id: 'open_ai_compatible/gpt-4.1-mini',
      providerName: 'Custom provider',
      providerKind: 'open_ai_compatible',
      providerId: 'open_ai_compatible',
    })
    const anthropic = model({
      id: 'anthropic/claude',
      providerName: 'Anthropic',
      providerKind: 'anthropic',
    })
    const named = model({
      id: 'scrub/m',
      modelId: 'm',
      displayName: 'm',
      providerName: 'Scrub test',
      providerKind: 'open_ai_compatible',
      providerId: 'scrub',
      baseUrl: 'https://scrub.example/v1',
    })
    const groups = buildPickerMenu({
      models: [custom, anthropic, openai, named],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(groups.map((group) => group.label)).toEqual(['ChatGPT', 'xAI (preview)', 'OpenAI API key', 'Scrub test'])
  })

  it('only sinks groups with no selectable model; accountNeedsSignIn does not sink API key rows', () => {
    const groups = buildPickerMenu({
      models: [openai, ollama, free],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
      accountNeedsSignIn: () => true,
    })
    expect(groups.map((group) => group.label)).toEqual([
      'ChatGPT',
      'xAI (preview)',
      'OpenAI API key',
      'Ollama',
      'Free tier',
    ])
    const openAi = groups.find((group) => group.label === 'OpenAI API key')
    expect(openAi?.rows.some((row) => !row.disabled)).toBe(true)
    expect(openAi?.accountSignIn).toBe(false)
    expect(groups.find((group) => group.section === 'accounts')?.accountSignIn).toBe(true)
  })

  it('puts the signed-in email in the ChatGPT group label, not a hint', () => {
    const groups = buildPickerMenu({
      models: [openai],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
      oauthByProvider: {
        openai: {
          provider: 'openai',
          enabled: true,
          signed_in: true,
          usable: true,
          email: 'plus@example.com',
          revoked: true,
        },
      },
      providers: [{
        id: 'openai',
        name: 'OpenAI',
        kind: 'open_ai',
        base_url: 'https://api.openai.com/v1',
        api_key_storage: 'none',
        models: [],
      }],
    })
    const chatgpt = groups.find((group) => group.id === 'account:openai')
    expect(chatgpt?.label).toBe('ChatGPT · plus@example.com')
    expect(chatgpt?.hint).toBeNull()
  })

  it('lists gpt models under ChatGPT when Ready and keeps them off the OpenAI API key group', () => {
    const groups = buildPickerMenu({
      models: [openai],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
      oauthByProvider: {
        openai: {
          provider: 'openai',
          enabled: true,
          signed_in: true,
          usable: true,
          email: 'plus@example.com',
          revoked: true,
        },
      },
      providers: [{
        id: 'openai',
        name: 'OpenAI',
        kind: 'open_ai',
        base_url: 'https://api.openai.com/v1',
        api_key_storage: 'local_file',
        models: [],
      }],
    })
    const chatgpt = groups.find((group) => group.id === 'account:openai')
    expect(chatgpt?.rows.map((row) => row.modelId)).toEqual(['gpt-4.1-mini'])
    expect(groups.find((group) => group.label === 'OpenAI API key')).toBeUndefined()
  })

  it('labels the openai providerId group OpenAI API key', () => {
    const catalog = model({
      id: 'openai/gpt-4.1-mini',
      modelId: 'gpt-4.1-mini',
      displayName: 'gpt-4.1-mini',
      providerName: 'OpenAI',
      providerKind: 'open_ai',
      providerId: 'openai',
      cacheKey: 'openai',
    })
    const groups = buildPickerMenu({
      models: [catalog],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(groups.filter((group) => group.providerKind === 'open_ai' && group.section === 'api_keys')).toHaveLength(1)
    expect(groups.find((group) => group.section === 'api_keys')?.label).toBe('OpenAI API key')
  })

})
