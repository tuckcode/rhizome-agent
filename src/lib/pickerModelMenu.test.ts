import { describe, expect, it } from 'vitest'
import {
  buildPickerMenu,
  chatProviderGroupLabel,
  pickerBlockReason,
  unsetProviderGroupCount,
  type PickerMenuModel,
} from './pickerModelMenu'

function model(overrides: Partial<PickerMenuModel> & Pick<PickerMenuModel, 'id' | 'providerName' | 'providerKind'>): PickerMenuModel {
  return {
    modelId: overrides.modelId ?? overrides.id,
    displayName: overrides.displayName ?? overrides.modelId ?? overrides.id,
    providerId: overrides.providerId ?? overrides.providerKind,
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
    expect(pickerBlockReason('Ollama', 'load_failed')).toBe("Couldn't load models. Retry.")
  })
})

describe('buildPickerMenu', () => {
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
    id: 'open_ai/gpt-4.1-mini',
    modelId: 'gpt-4.1-mini',
    displayName: 'gpt-4.1-mini',
    providerName: 'OpenAI',
    providerKind: 'open_ai',
  })

  it('drops the provider prefix under a header when two providers share a model name', () => {
    const groups = buildPickerMenu({
      models: [ollama, studio],
      failures: [],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(groups.map((group) => group.label)).toEqual(['Ollama', 'LM Studio'])
    expect(groups[0].rows[0].label).toBe('llama3.2')
    expect(groups[1].rows[0].label).toBe('llama3.2')
    expect(groups[0].rows[0].disabled).toBe(false)
  })

  it('disables a keyless provider and points Add key at the API tab', () => {
    const groups = buildPickerMenu({
      models: [openai],
      failures: [],
      loadingNames: [],
      needsKey: (kind) => kind === 'open_ai',
    })
    expect(groups[0].blocked).toBe(true)
    expect(groups[0].rows[0]).toMatchObject({
      disabled: true,
      reason: 'Needs an API key',
      action: 'add_key',
      tab: 'api',
    })
    expect(unsetProviderGroupCount(groups)).toBe(1)
  })

  it('disables Ollama when it is not running and keeps a model row', () => {
    const groups = buildPickerMenu({
      models: [ollama],
      failures: [{ providerName: 'Ollama', kind: 'unreachable' }],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(groups[0].rows[0]).toMatchObject({
      disabled: true,
      reason: "Ollama isn't running",
      action: 'retry',
      tab: 'local',
    })
  })

  it('says no models found and could not load, and does not count a loading group', () => {
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
      failures: [{ providerName: 'Scrub test', kind: 'timeout' }],
      loadingNames: ['Scrub test'],
      needsKey: () => false,
    })
    expect(loading[0].rows[0].disabled).toBe(false)
    expect(unsetProviderGroupCount(loading)).toBe(0)

    const failed = buildPickerMenu({
      models: [scrub],
      failures: [{ providerName: 'Scrub test', kind: 'timeout' }],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(failed[0].label).toBe('Scrub test')
    expect(failed[0].rows[0].reason).toBe("Couldn't load models. Retry.")

    const empty = buildPickerMenu({
      models: [studio],
      failures: [{ providerName: 'LM Studio', kind: 'empty' }],
      loadingNames: [],
      needsKey: () => false,
    })
    expect(empty[0].rows[0].reason).toBe('No models found')
    expect(unsetProviderGroupCount(empty)).toBe(1)
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
    expect(groups.map((group) => group.label)).toEqual(['OpenAI', 'Scrub test'])
  })
})
