import {
  aiModelProviderCatalogEntry,
  type AiModelApiKeyStorage,
  type AiModelProviderKind,
} from './aiTargets'

/** API styles this Settings form can prefill. Matches stored provider kinds. */
export type ProviderApiStyle = Extract<
  AiModelProviderKind,
  'open_ai' | 'anthropic' | 'open_ai_compatible' | 'open_router' | 'gemini'
>

export interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  keyPageUrl: string
  apiStyle: ProviderApiStyle
}

export const CUSTOM_PROVIDER_PRESET_ID = 'custom'

export const PROVIDER_PRESETS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyPageUrl: 'https://platform.claude.com/settings/keys',
    apiStyle: 'anthropic',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyPageUrl: 'https://platform.openai.com/api-keys',
    apiStyle: 'open_ai',
  },
  {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    keyPageUrl: 'https://console.x.ai',
    apiStyle: 'open_ai_compatible',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPageUrl: 'https://aistudio.google.com/app/apikey',
    apiStyle: 'gemini',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPageUrl: 'https://openrouter.ai/keys',
    apiStyle: 'open_router',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyPageUrl: 'https://console.groq.com/keys',
    apiStyle: 'open_ai_compatible',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyPageUrl: 'https://console.mistral.ai/api-keys',
    apiStyle: 'open_ai_compatible',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    keyPageUrl: 'https://platform.deepseek.com/api_keys',
    apiStyle: 'open_ai_compatible',
  },
] as const satisfies readonly ProviderPreset[]

const PROVIDER_PRESETS_BY_ID = new Map<string, ProviderPreset>(
  PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
)

export function providerPresetById(id: string): ProviderPreset | null {
  return PROVIDER_PRESETS_BY_ID.get(id) ?? null
}

export function defaultApiProviderPreset(): ProviderPreset {
  return providerPresetById('openai') ?? PROVIDER_PRESETS[0]
}

export interface ProviderPresetDraftPatch {
  presetId: string
  kind: AiModelProviderKind
  name: string
  baseUrl: string
  apiKeyStorage: AiModelApiKeyStorage
  apiKeyEnvVar: string
}

export function draftPatchForProviderPreset(preset: ProviderPreset): ProviderPresetDraftPatch {
  const defaults = aiModelProviderCatalogEntry(preset.apiStyle)
  return {
    presetId: preset.id,
    kind: preset.apiStyle,
    name: preset.label,
    baseUrl: preset.baseUrl,
    apiKeyStorage: defaults.api_key_storage,
    apiKeyEnvVar: defaults.api_key_env_var ?? '',
  }
}

export function draftPatchForCustomProvider(baseUrl = ''): ProviderPresetDraftPatch {
  const defaults = aiModelProviderCatalogEntry('open_ai_compatible')
  return {
    presetId: CUSTOM_PROVIDER_PRESET_ID,
    kind: 'open_ai_compatible',
    name: defaults.name,
    baseUrl,
    apiKeyStorage: defaults.api_key_storage,
    apiKeyEnvVar: defaults.api_key_env_var ?? '',
  }
}
