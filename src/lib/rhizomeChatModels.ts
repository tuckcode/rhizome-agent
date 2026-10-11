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

function isAnthropicTarget(id: string): boolean {
  const value = id.trim().toLowerCase()
  return value.startsWith('anthropic/') || value.includes('/claude')
}

export interface RhizomeChatModel {
  id: string
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

function addModel(into: Map<string, RhizomeChatModel>, model: RhizomeChatModel): void {
  if (isAnthropicTarget(model.id)) return
  into.set(model.id, model)
}

/** Catalog defaults plus Settings-configured models. Never empty. */
export function seedRhizomeChatModels(
  providers?: AiModelProvider[] | null,
): RhizomeChatModel[] {
  const into = new Map<string, RhizomeChatModel>()
  for (const entry of CATALOG) {
    addModel(into, {
      id: `${entry.kind}/${entry.default_model_id}`,
      providerKind: entry.kind,
      providerName: entry.name,
      modelId: entry.default_model_id,
      label: `${entry.name} · ${entry.default_model_id}`,
    })
  }
  for (const provider of normalizeAiModelProviders(providers)) {
    for (const model of provider.models) {
      addModel(into, {
        id: `${provider.kind}/${model.id}`,
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

export function isWellFormedRhizomeTarget(id: string): boolean {
  const trimmed = id.trim()
  if (!trimmed) return false
  if (trimmed === FREE_TIER_AUTO_TARGET) return true
  if (isAnthropicTarget(trimmed)) return false
  return trimmed.includes('/')
}

function catalogEntry(kind: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.kind === kind)
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
        max_output_tokens: null,
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
            id: `${provider.kind}/${id}`,
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
    providerKind: 'free_tier',
    providerName: 'Free tier',
    modelId: FREE_TIER_AUTO_TARGET,
    label: FREE_TIER_AUTO_LABEL,
  })
  return listed
}
