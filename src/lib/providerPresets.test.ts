import { describe, expect, it } from 'vitest'
import { aiModelProviderCatalogEntry } from './aiTargets'
import {
  CUSTOM_PROVIDER_PRESET_ID,
  PROVIDER_PRESETS,
  defaultApiProviderPreset,
  draftPatchForCustomProvider,
  draftPatchForProviderPreset,
  mergeProviderPresetPatch,
  providerApiKeyPlaceholder,
  providerPresetById,
  type ProviderApiStyle,
  type ProviderPreset,
} from './providerPresets'

const API_STYLES = new Set<ProviderApiStyle>([
  'open_ai',
  'anthropic',
  'open_ai_compatible',
  'open_router',
  'gemini',
])

const PRESET_ENV_VARS = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  xai: 'XAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
} as const

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

describe('provider preset table', () => {
  it('keeps OpenAI first and one typed row per popular provider', () => {
    expect(PROVIDER_PRESETS.map((preset) => preset.id)).toEqual([
      'openai',
      'anthropic',
      'xai',
      'gemini',
      'openrouter',
      'groq',
      'mistral',
      'deepseek',
    ])
  })

  it('requires id, label, base URL, key page, API style, model id, and env var on every row', () => {
    const ids = new Set<string>()
    const labels = new Set<string>()

    for (const preset of PROVIDER_PRESETS) {
      const row: ProviderPreset = preset
      expect(row.id.trim()).not.toBe('')
      expect(row.label.trim()).not.toBe('')
      expect(isHttpsUrl(row.baseUrl)).toBe(true)
      expect(isHttpsUrl(row.keyPageUrl)).toBe(true)
      expect(API_STYLES.has(row.apiStyle)).toBe(true)
      expect(row.apiKeyEnvVar.trim()).not.toBe('')
      expect(row.modelId.trim()).not.toBe('')
      expect(ids.has(row.id)).toBe(false)
      expect(labels.has(row.label)).toBe(false)
      ids.add(row.id)
      labels.add(row.label)
      expect(() => aiModelProviderCatalogEntry(row.apiStyle)).not.toThrow()
    }

    expect(ids.has(CUSTOM_PROVIDER_PRESET_ID)).toBe(false)
  })

  it.each(PROVIDER_PRESETS)('$id uses its own $apiKeyEnvVar and never inherits another vendor key', (preset) => {
    expect(preset.apiKeyEnvVar).toBe(PRESET_ENV_VARS[preset.id])
    expect(draftPatchForProviderPreset(preset).apiKeyEnvVar).toBe(PRESET_ENV_VARS[preset.id])
    if (preset.apiStyle === 'open_ai_compatible') {
      expect(preset.apiKeyEnvVar).not.toBe(aiModelProviderCatalogEntry(preset.apiStyle).api_key_env_var)
      expect(preset.apiKeyEnvVar).not.toBe('OPENAI_API_KEY')
    }
  })

  it('looks up a preset by id and starts API setup on OpenAI', () => {
    expect(providerPresetById('groq')).toMatchObject({
      label: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      keyPageUrl: 'https://console.groq.com/keys',
      apiStyle: 'open_ai_compatible',
      apiKeyEnvVar: 'GROQ_API_KEY',
      modelId: 'openai/gpt-oss-120b',
    })
    expect(providerPresetById('missing')).toBeNull()
    expect(defaultApiProviderPreset()).toMatchObject({
      id: 'openai',
      apiKeyEnvVar: 'OPENAI_API_KEY',
    })
    expect(defaultApiProviderPreset().id).toBe('openai')
  })

  it('prefills stored provider fields from a preset without inventing a new kind', () => {
    expect(draftPatchForProviderPreset(providerPresetById('anthropic')!)).toEqual({
      presetId: 'anthropic',
      kind: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      modelId: 'claude-sonnet-5-5',
      apiKeyStorage: 'local_file',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    })
    expect(draftPatchForCustomProvider('https://lab.example/v1')).toEqual({
      presetId: CUSTOM_PROVIDER_PRESET_ID,
      kind: 'open_ai_compatible',
      name: 'Custom provider',
      baseUrl: 'https://lab.example/v1',
      modelId: '',
      apiKeyStorage: 'local_file',
      apiKeyEnvVar: '',
    })
  })

  it('takes the new named preset URL even when the current URL was edited', () => {
    const current = {
      presetId: 'openai',
      kind: 'open_ai' as const,
      name: 'Lab OpenAI',
      baseUrl: 'https://lab.example/v1',
      modelId: 'gpt-6-luna',
      apiKeyStorage: 'local_file' as const,
      apiKeyEnvVar: 'OPENAI_API_KEY',
      apiKey: 'sk-live-openai',
    }
    const groq = draftPatchForProviderPreset(providerPresetById('groq')!)
    expect(mergeProviderPresetPatch(current, groq, {
      name: false,
      baseUrl: false,
      modelId: false,
    }, true)).toMatchObject({
      presetId: 'groq',
      kind: 'open_ai_compatible',
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      modelId: 'openai/gpt-oss-120b',
      apiKeyEnvVar: 'GROQ_API_KEY',
      apiKey: '',
    })
  })

  it('keeps the current Custom URL when keepBaseUrl is set, even if it was not edited', () => {
    const current = {
      presetId: CUSTOM_PROVIDER_PRESET_ID,
      kind: 'open_ai_compatible' as const,
      name: 'Custom provider',
      baseUrl: 'https://lab.example/v1',
      modelId: '',
      apiKeyStorage: 'local_file' as const,
      apiKeyEnvVar: '',
      apiKey: '',
    }
    const openAiStyle = draftPatchForCustomProvider(current.baseUrl)
    expect(mergeProviderPresetPatch(current, {
      ...openAiStyle,
      kind: 'open_ai',
      name: 'OpenAI',
    }, {
      name: false,
      baseUrl: false,
      modelId: false,
    }, false, true)).toMatchObject({
      baseUrl: 'https://lab.example/v1',
    })
  })

  it('names the API key placeholder after the provider', () => {
    expect(providerApiKeyPlaceholder('OpenAI')).toBe('Paste your OpenAI key')
  })
})
