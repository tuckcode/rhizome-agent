import { describe, expect, it } from 'vitest'
import { aiModelProviderCatalogEntry } from './aiTargets'
import {
  CUSTOM_PROVIDER_PRESET_ID,
  PROVIDER_PRESETS,
  defaultApiProviderPreset,
  draftPatchForCustomProvider,
  draftPatchForProviderPreset,
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

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

describe('provider preset table', () => {
  it('keeps one typed row per popular provider', () => {
    expect(PROVIDER_PRESETS.map((preset) => preset.id)).toEqual([
      'anthropic',
      'openai',
      'xai',
      'gemini',
      'openrouter',
      'groq',
      'mistral',
      'deepseek',
    ])
  })

  it('requires id, label, base URL, key page, and API style on every row', () => {
    const ids = new Set<string>()
    const labels = new Set<string>()

    for (const preset of PROVIDER_PRESETS) {
      const row: ProviderPreset = preset
      expect(row.id.trim()).not.toBe('')
      expect(row.label.trim()).not.toBe('')
      expect(isHttpsUrl(row.baseUrl)).toBe(true)
      expect(isHttpsUrl(row.keyPageUrl)).toBe(true)
      expect(API_STYLES.has(row.apiStyle)).toBe(true)
      expect(ids.has(row.id)).toBe(false)
      expect(labels.has(row.label)).toBe(false)
      ids.add(row.id)
      labels.add(row.label)
      expect(() => aiModelProviderCatalogEntry(row.apiStyle)).not.toThrow()
    }

    expect(ids.has(CUSTOM_PROVIDER_PRESET_ID)).toBe(false)
  })

  it('looks up a preset by id and starts API setup on OpenAI', () => {
    expect(providerPresetById('groq')).toMatchObject({
      label: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      keyPageUrl: 'https://console.groq.com/keys',
      apiStyle: 'open_ai_compatible',
    })
    expect(providerPresetById('missing')).toBeNull()
    expect(defaultApiProviderPreset().id).toBe('openai')
  })

  it('prefills stored provider fields from a preset without inventing a new kind', () => {
    expect(draftPatchForProviderPreset(providerPresetById('anthropic')!)).toEqual({
      presetId: 'anthropic',
      kind: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKeyStorage: 'local_file',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    })
    expect(draftPatchForCustomProvider('https://lab.example/v1')).toEqual({
      presetId: CUSTOM_PROVIDER_PRESET_ID,
      kind: 'open_ai_compatible',
      name: 'Custom provider',
      baseUrl: 'https://lab.example/v1',
      apiKeyStorage: 'local_file',
      apiKeyEnvVar: 'OPENAI_API_KEY',
    })
  })
})
