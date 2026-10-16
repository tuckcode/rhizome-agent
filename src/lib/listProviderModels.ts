import {
  isLocalAiProvider,
  LOCAL_AI_PROVIDER_KINDS,
  normalizeAiModelProviders,
  type AiModelProvider,
} from './aiTargets'
import { callHost } from './callHost'
import {
  providerForDiscover,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from './rhizomeChatModels'

const FREE_TIER_AUTO_TARGET = 'free_tier_auto'

const cached = new Map<string, string[]>()
const inflight = new Map<string, Promise<string[]>>()

export function resetListProviderModelsCache(): void {
  cached.clear()
  inflight.clear()
}

export function providerModelsCacheKey(provider: Pick<AiModelProvider, 'id' | 'kind'>): string {
  return provider.id.trim() || provider.kind
}

export function providerHasListKey(provider: AiModelProvider): boolean {
  if (provider.api_key_storage === 'local_file' || provider.api_key_storage === 'env') return true
  return Boolean(provider.api_key_env_var?.trim())
}

export function canListProviderModelsLive(provider: AiModelProvider): boolean {
  return providerHasListKey(provider) || isLocalAiProvider(provider)
}

export function staticProviderModelIds(provider: AiModelProvider): string[] {
  return provider.models.map((model) => model.id.trim()).filter(Boolean)
}

export function isProviderModelsCached(provider: Pick<AiModelProvider, 'id' | 'kind'>): boolean {
  return cached.has(providerModelsCacheKey(provider))
}

export function providersToListLive(providers?: AiModelProvider[] | null): AiModelProvider[] {
  const jobs = new Map<string, AiModelProvider>()
  for (const kind of LOCAL_AI_PROVIDER_KINDS) {
    const provider = providerForDiscover(kind)
    if (!canListProviderModelsLive(provider)) continue
    jobs.set(providerModelsCacheKey(provider), provider)
  }
  for (const provider of normalizeAiModelProviders(providers)) {
    if (provider.kind === 'anthropic' || !canListProviderModelsLive(provider)) continue
    jobs.set(providerModelsCacheKey(provider), provider)
  }
  return [...jobs.values()]
}

export function pendingLiveProviderNames(providers?: AiModelProvider[] | null): string[] {
  return providersToListLive(providers)
    .filter((provider) => !isProviderModelsCached(provider))
    .map((provider) => provider.name)
}

/** Live `/models` for a keyed or local provider. Failures and keyless hosts use the static list. */
export async function listAiModelProviderModels(provider: AiModelProvider): Promise<string[]> {
  const fallback = staticProviderModelIds(provider)
  if (!canListProviderModelsLive(provider)) return fallback

  const key = providerModelsCacheKey(provider)
  const hit = cached.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending

  const request = (async () => {
    try {
      const ids = await callHost<string[]>('list_ai_model_provider_models', { provider })
      const live = Array.isArray(ids) ? ids.map((id) => id.trim()).filter(Boolean) : fallback
      cached.set(key, live)
      return live
    } catch {
      return fallback
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, request)
  return request
}

function liveChatModel(provider: AiModelProvider, modelId: string): RhizomeChatModel {
  const providerId = providerModelsCacheKey(provider)
  return {
    id: `${providerId}/${modelId}`,
    providerId,
    providerKind: provider.kind,
    providerName: provider.name,
    modelId,
    displayName: modelId,
    label: `${provider.name} · ${modelId}`,
  }
}

/** Seed catalog plus a live list per keyed or local provider. Cached for the session. */
export async function loadLiveRhizomeChatModels(
  providers?: AiModelProvider[] | null,
): Promise<RhizomeChatModel[]> {
  const seed = seedRhizomeChatModels(providers)
  const into = new Map(seed.map((model) => [model.id, model]))
  await Promise.all(
    providersToListLive(providers).map(async (provider) => {
      const ids = await listAiModelProviderModels(provider)
      for (const modelId of ids) {
        const model = liveChatModel(provider, modelId)
        if (model.providerKind === 'anthropic' || into.has(model.id)) continue
        into.set(model.id, model)
      }
    }),
  )
  const listed = [...into.values()].filter((model) => model.id !== FREE_TIER_AUTO_TARGET)
  const freeTier = seed.find((model) => model.id === FREE_TIER_AUTO_TARGET)
  if (freeTier) listed.push(freeTier)
  return listed
}
