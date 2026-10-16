import catalog from '../shared/aiModelProviderCatalog.json' with { type: 'json' }
import {
  DEFAULT_MODEL_CAPABILITIES,
  normalizeAiModelProviders,
  type AiModelProvider,
  type AiModelProviderKind,
} from './aiTargets'
import { callHost } from './callHost'

const FREE_TIER_AUTO_TARGET = 'free_tier_auto'
const FREE_TIER_AUTO_LABEL = 'Free tier (auto)'

export const REMOVED_PROVIDER_LABEL = 'Provider removed'
export const REMOVED_PROVIDER_ERROR =
  "This model's provider was removed. Pick another model, or add the provider back in Settings → AI Agents."

const LEGACY_PROVIDER_KIND_IDS = new Set([
  'anthropic',
  'openai',
  'open_ai',
  'ollama',
  'lmstudio',
  'lm_studio',
  'openrouter',
  'open_router',
  'gemini',
  'open_ai_compatible',
  'openai_compatible',
  'compatible',
])

export function isLegacyProviderKindId(id: string): boolean {
  return LEGACY_PROVIDER_KIND_IDS.has(id.trim().toLowerCase().replace(/-/g, '_'))
}

/** Direct Anthropic / Claude Code ids. OpenRouter Claude stays visible. */
export function isAnthropicTarget(
  id: string,
  providers?: AiModelProvider[] | null,
): boolean {
  const value = id.trim().toLowerCase()
  if (
    value.startsWith('anthropic/') ||
    value.startsWith('claude_code/') ||
    value.startsWith('claude-code/')
  ) {
    return true
  }
  const parts = splitTarget(id)
  if (!parts) return false
  const providerId = parts.provider.trim().toLowerCase()
  return normalizeAiModelProviders(providers).some((provider) => {
    if (provider.kind !== 'anthropic') return false
    return providerKey(provider) === providerId || provider.kind === providerId
  })
}

export interface RhizomeChatModel {
  id: string
  providerId: string
  providerKind: string
  providerName: string
  modelId: string
  label: string
}

interface CatalogEntry {
  kind: string
  name: string
  default_model_id: string
  base_url: string
  api_key_storage: string
  api_key_env_var: string | null
  local: boolean
}

const CATALOG = catalog as readonly CatalogEntry[]

function providerKey(provider: Pick<AiModelProvider, 'id' | 'kind'>): string {
  return provider.id.trim() || provider.kind
}

function splitTarget(id: string): { provider: string; modelId: string } | null {
  const slash = id.indexOf('/')
  if (slash <= 0 || slash === id.length - 1) return null
  return { provider: id.slice(0, slash), modelId: id.slice(slash + 1) }
}

function addModel(into: Map<string, RhizomeChatModel>, model: RhizomeChatModel): void {
  if (model.providerKind === 'anthropic' || isAnthropicTarget(model.id)) return
  into.set(model.id, model)
}

function matchesStoredTarget(model: RhizomeChatModel, provider: string, modelId: string): boolean {
  return (
    model.modelId === modelId
    && (model.providerId === provider || model.providerKind === provider)
  )
}

/** Exact id, or a unique old `kind/model` selection. */
export function resolveRhizomeChatModel(
  models: RhizomeChatModel[],
  selectedId: string | null | undefined,
): RhizomeChatModel | undefined {
  const value = selectedId?.trim()
  if (!value) return undefined
  const exact = models.find((model) => model.id === value)
  if (exact) return exact
  const parts = splitTarget(value)
  if (!parts) return undefined
  const matches = models.filter((model) => matchesStoredTarget(model, parts.provider, parts.modelId))
  return matches[0]
}

/** Keep a deleted configured-provider selection visible in the picker. */
export function includeRemovedProviderModel(
  models: RhizomeChatModel[],
  selectedId: string | null | undefined,
): RhizomeChatModel[] {
  const value = selectedId?.trim()
  if (!value || resolveRhizomeChatModel(models, value)) return models
  const parts = splitTarget(value)
  if (!parts || isLegacyProviderKindId(parts.provider)) return models
  return [
    {
      id: value,
      providerId: parts.provider,
      providerKind: parts.provider,
      providerName: REMOVED_PROVIDER_LABEL,
      modelId: parts.modelId,
      label: REMOVED_PROVIDER_LABEL,
    },
    ...models,
  ]
}

/** Rewrite a unique kind-keyed selection to the provider-id target. */
export function migrateRhizomeChatTarget(
  models: RhizomeChatModel[],
  selectedId: string,
): string {
  const exact = models.find((model) => model.id === selectedId)
  if (exact) return exact.id
  const parts = splitTarget(selectedId)
  if (!parts) return selectedId
  const matches = models.filter((model) => matchesStoredTarget(model, parts.provider, parts.modelId))
  return matches.length === 1 ? matches[0].id : selectedId
}

/** Catalog defaults plus Settings-configured models. Never empty. */
export function seedRhizomeChatModels(
  providers?: AiModelProvider[] | null,
): RhizomeChatModel[] {
  const into = new Map<string, RhizomeChatModel>()
  for (const entry of CATALOG) {
    addModel(into, {
      id: `${entry.kind}/${entry.default_model_id}`,
      providerId: entry.kind,
      providerKind: entry.kind,
      providerName: entry.name,
      modelId: entry.default_model_id,
      label: `${entry.name} · ${entry.default_model_id}`,
    })
  }
  for (const provider of normalizeAiModelProviders(providers)) {
    const key = providerKey(provider)
    for (const model of provider.models) {
      addModel(into, {
        id: `${key}/${model.id}`,
        providerId: key,
        providerKind: provider.kind,
        providerName: provider.name,
        modelId: model.id,
        label: `${provider.name} · ${model.display_name || model.id}`,
      })
    }
  }
  const listed = [...into.values()]
  listed.push({
    id: FREE_TIER_AUTO_TARGET,
    providerId: 'free_tier',
    providerKind: 'free_tier',
    providerName: 'Free tier',
    modelId: FREE_TIER_AUTO_TARGET,
    label: FREE_TIER_AUTO_LABEL,
  })
  return listed
}

export function groupRhizomeChatModels(
  models: RhizomeChatModel[],
): Array<{ provider: string; models: RhizomeChatModel[] }> {
  const groups: Array<{ provider: string; models: RhizomeChatModel[] }> = []
  const index = new Map<string, number>()
  for (const model of models) {
    const existing = index.get(model.providerName)
    if (existing === undefined) {
      index.set(model.providerName, groups.length)
      groups.push({ provider: model.providerName, models: [model] })
      continue
    }
    groups[existing].models.push(model)
  }
  return groups
}

export function filterRhizomeChatModels(
  models: RhizomeChatModel[],
  query: string,
): RhizomeChatModel[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return models
  return models.filter((model) => {
    return (
      model.label.toLowerCase().includes(needle) ||
      model.modelId.toLowerCase().includes(needle) ||
      model.providerName.toLowerCase().includes(needle)
    )
  })
}

export function isWellFormedRhizomeTarget(
  id: string,
  providers?: AiModelProvider[] | null,
): boolean {
  const trimmed = id.trim()
  if (!trimmed) return false
  if (trimmed === FREE_TIER_AUTO_TARGET) return true
  if (isAnthropicTarget(trimmed, providers)) return false
  return trimmed.includes('/')
}

function catalogEntry(kind: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.kind === kind)
}

/** Remote catalog kinds with no configured provider still need a Settings key. */
export function rhizomeProviderNeedsApiKey(
  providerKind: string,
  providers?: AiModelProvider[] | null,
): boolean {
  const entry = catalogEntry(providerKind)
  if (!entry || entry.local || entry.api_key_storage === 'none') return false
  return !normalizeAiModelProviders(providers).some((provider) => provider.kind === providerKind)
}

export function providerForDiscover(
  kind: string,
  configured?: AiModelProvider,
): AiModelProvider {
  if (configured) return configured
  const entry = catalogEntry(kind)
  const modelId = entry?.default_model_id || 'default'
  return {
    id: kind,
    name: entry?.name ?? kind,
    kind: kind as AiModelProviderKind,
    base_url: entry?.base_url ?? null,
    api_key_storage: (entry?.api_key_storage as AiModelProvider['api_key_storage']) ?? 'none',
    api_key_env_var: entry?.api_key_env_var ?? null,
    headers: null,
    models: [
      {
        id: modelId,
        display_name: null,
        context_window: null,
        capabilities: DEFAULT_MODEL_CAPABILITIES,
      },
    ],
  }
}

function shouldDiscover(provider: AiModelProvider): boolean {
  const entry = catalogEntry(provider.kind)
  if (entry?.local) return true
  return Boolean(provider.base_url)
}

/** Live `/v1/models` for local and configured providers. Failures are dropped. */
export async function discoverRhizomeChatModels(
  providers?: AiModelProvider[] | null,
): Promise<RhizomeChatModel[]> {
  const configured = normalizeAiModelProviders(providers)
  const jobs = new Map<string, AiModelProvider>()
  for (const entry of CATALOG) {
    if (!entry.local) continue
    jobs.set(entry.kind, providerForDiscover(entry.kind))
  }
  for (const provider of configured) {
    if (!shouldDiscover(provider)) continue
    jobs.set(provider.id || provider.kind, provider)
  }

  const extra: RhizomeChatModel[] = []
  await Promise.all(
    [...jobs.values()].map(async (provider) => {
      try {
        const ids = await callHost<string[]>('discover_ai_models', {
          provider,
        })
        if (!Array.isArray(ids)) return
        for (const modelId of ids) {
          const id = modelId.trim()
          if (!id) continue
          extra.push({
            id: `${providerKey(provider)}/${id}`,
            providerId: providerKey(provider),
            providerKind: provider.kind,
            providerName: provider.name,
            modelId: id,
            label: `${provider.name} · ${id}`,
          })
        }
      } catch {
        // A failed discover is not remembered. The seed list stays.
      }
    }),
  )
  return extra
}

export async function loadRhizomeChatModels(
  providers?: AiModelProvider[] | null,
): Promise<RhizomeChatModel[]> {
  const seed = seedRhizomeChatModels(providers)
  const discovered = await discoverRhizomeChatModels(providers)
  const into = new Map(seed.map((model) => [model.id, model]))
  for (const model of discovered) addModel(into, model)
  const listed = [...into.values()].filter((model) => model.id !== FREE_TIER_AUTO_TARGET)
  listed.push({
    id: FREE_TIER_AUTO_TARGET,
    providerId: 'free_tier',
    providerKind: 'free_tier',
    providerName: 'Free tier',
    modelId: FREE_TIER_AUTO_TARGET,
    label: FREE_TIER_AUTO_LABEL,
  })
  return listed
}
