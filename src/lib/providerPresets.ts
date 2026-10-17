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
  /** Env var to read when storage is `env`. Never inherit another vendor's key. */
  apiKeyEnvVar: string
  /** Real model id to fill — not placeholder copy. */
  modelId: string
}

export const CUSTOM_PROVIDER_PRESET_ID = 'custom'

export const PROVIDER_PRESETS = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyPageUrl: 'https://platform.openai.com/api-keys',
    apiStyle: 'open_ai',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    modelId: 'gpt-4.1-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyPageUrl: 'https://platform.claude.com/settings/keys',
    apiStyle: 'anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    modelId: 'claude-3-5-sonnet-latest',
  },
  {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    keyPageUrl: 'https://console.x.ai',
    apiStyle: 'open_ai_compatible',
    apiKeyEnvVar: 'XAI_API_KEY',
    modelId: 'grok-4',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPageUrl: 'https://aistudio.google.com/app/apikey',
    apiStyle: 'gemini',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    modelId: 'gemini-2.5-flash',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPageUrl: 'https://openrouter.ai/keys',
    apiStyle: 'open_router',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    modelId: 'openai/gpt-4.1-mini',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyPageUrl: 'https://console.groq.com/keys',
    apiStyle: 'open_ai_compatible',
    apiKeyEnvVar: 'GROQ_API_KEY',
    modelId: 'llama-3.3-70b-versatile',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyPageUrl: 'https://console.mistral.ai/api-keys',
    apiStyle: 'open_ai_compatible',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    modelId: 'mistral-small-latest',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    keyPageUrl: 'https://platform.deepseek.com/api_keys',
    apiStyle: 'open_ai_compatible',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    modelId: 'deepseek-chat',
  },
] as const satisfies readonly ProviderPreset[]

const PROVIDER_PRESETS_BY_ID = new Map<string, ProviderPreset>(
  PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
)

export function providerPresetById(id: string): ProviderPreset | null {
  return PROVIDER_PRESETS_BY_ID.get(id) ?? null
}

export function defaultApiProviderPreset(): ProviderPreset {
  const openai = providerPresetById('openai')
  if (!openai) throw new Error('OpenAI provider preset is missing')
  return openai
}

export function providerApiKeyPlaceholder(label: string): string {
  return `Paste your ${label} key`
}

export interface ProviderPresetDraftPatch {
  presetId: string
  kind: AiModelProviderKind
  name: string
  baseUrl: string
  modelId: string
  apiKeyStorage: AiModelApiKeyStorage
  apiKeyEnvVar: string
}

export interface ProviderDraftTouched {
  name: boolean
  baseUrl: boolean
  modelId: boolean
}

export function draftPatchForProviderPreset(preset: ProviderPreset): ProviderPresetDraftPatch {
  const defaults = aiModelProviderCatalogEntry(preset.apiStyle)
  return {
    presetId: preset.id,
    kind: preset.apiStyle,
    name: preset.label,
    baseUrl: preset.baseUrl,
    modelId: preset.modelId,
    apiKeyStorage: defaults.api_key_storage,
    apiKeyEnvVar: preset.apiKeyEnvVar,
  }
}

export function draftPatchForCustomProvider(baseUrl = ''): ProviderPresetDraftPatch {
  const defaults = aiModelProviderCatalogEntry('open_ai_compatible')
  return {
    presetId: CUSTOM_PROVIDER_PRESET_ID,
    kind: 'open_ai_compatible',
    name: defaults.name,
    baseUrl,
    modelId: '',
    apiKeyStorage: defaults.api_key_storage,
    apiKeyEnvVar: defaults.api_key_env_var ?? '',
  }
}

export function mergeProviderPresetPatch<T extends {
  name: string
  baseUrl: string
  modelId: string
  apiKey: string
}>(
  current: T,
  patch: ProviderPresetDraftPatch,
  touched: ProviderDraftTouched,
  clearApiKey: boolean,
): T & ProviderPresetDraftPatch {
  return {
    ...current,
    ...patch,
    name: touched.name ? current.name : patch.name,
    baseUrl: touched.baseUrl ? current.baseUrl : patch.baseUrl,
    modelId: touched.modelId ? current.modelId : patch.modelId,
    apiKey: clearApiKey ? '' : current.apiKey,
  }
}
