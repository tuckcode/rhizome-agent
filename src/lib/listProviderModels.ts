import {
  isLocalAiProvider,
  LOCAL_AI_PROVIDER_KINDS,
  type AiModelProvider,
} from './aiTargets'
import { callHost } from './callHost'
import {
  providerForDiscover,
  seedRhizomeChatModels,
  type RhizomeChatModel,
} from './rhizomeChatModels'

const FREE_TIER_AUTO_TARGET = 'free_tier_auto'

export interface ListedProviderModel {
  id: string
  displayName: string
}

const cached = new Map<string, ListedProviderModel[]>()
const inflight = new Map<string, Promise<ListedProviderModel[]>>()
const failed = new Set<string>()

export function resetListProviderModelsCache(): void {
  cached.clear()
  inflight.clear()
  failed.clear()
}

export function providerModelsCacheKey(provider: Pick<AiModelProvider, 'id' | 'kind' | 'base_url'>): string {
  const id = provider.id.trim() || provider.kind
  const base = provider.base_url?.trim() ?? ''
  return base ? `${id}::${base}` : id
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

export function isProviderModelsCached(provider: Pick<AiModelProvider, 'id' | 'kind' | 'base_url'>): boolean {
  return cached.has(providerModelsCacheKey(provider))
}

export function providersToListLive(providers?: AiModelProvider[] | null): AiModelProvider[] {
  const jobs = new Map<string, AiModelProvider>()
  for (const kind of LOCAL_AI_PROVIDER_KINDS) {
    const provider = providerForDiscover(kind)
    if (!canListProviderModelsLive(provider)) continue
    jobs.set(providerModelsCacheKey(provider), provider)
  }
  for (const provider of providers ?? []) {
    if (provider.kind === 'anthropic' || !canListProviderModelsLive(provider)) continue
    const id = provider.id.trim() || provider.kind
    const name = provider.name.trim()
    if (!id || !name) continue
    const listed = { ...provider, id, name }
    jobs.set(providerModelsCacheKey(listed), listed)
  }
  return [...jobs.values()]
}

export function pendingLiveProviderNames(providers?: AiModelProvider[] | null): string[] {
  return providersToListLive(providers)
    .filter((provider) => !isProviderModelsCached(provider))
    .map((provider) => provider.name)
}

export function offlineLiveProviderNames(providers?: AiModelProvider[] | null): string[] {
  return providersToListLive(providers)
    .filter((provider) => failed.has(providerModelsCacheKey(provider)))
    .map((provider) => provider.name)
}

export function liveProviderHeadingNames(providers?: AiModelProvider[] | null): string[] {
  return providersToListLive(providers).map((provider) => provider.name)
}

export function liveModelDisplayName(id: string, apiName?: string | null): string {
  const given = apiName?.trim()
  if (given) return given
  const last = id.split('/').filter(Boolean).pop() ?? id
  return last.replace(/:latest$/i, '')
}

export function normalizeListedProviderModels(raw: unknown): ListedProviderModel[] {
  if (!Array.isArray(raw)) return []
  const listed: ListedProviderModel[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const id = entry.trim()
      if (!id) continue
      listed.push({ id, displayName: liveModelDisplayName(id) })
      continue
    }
    if (!entry || typeof entry !== 'object') continue
    const record = entry as { id?: unknown; display_name?: unknown; displayName?: unknown; name?: unknown }
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!id) continue
    const apiName = [record.display_name, record.displayName, record.name]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    listed.push({ id, displayName: liveModelDisplayName(id, apiName) })
  }
  return listed
}

function staticProviderModels(provider: AiModelProvider): ListedProviderModel[] {
  return staticProviderModelIds(provider).map((id) => {
    const seeded = provider.models.find((model) => model.id.trim() === id)
    return {
      id,
      displayName: liveModelDisplayName(id, seeded?.display_name),
    }
  })
}

async function listProviderModelEntries(provider: AiModelProvider): Promise<ListedProviderModel[]> {
  const fallback = staticProviderModels(provider)
  if (!canListProviderModelsLive(provider)) return fallback

  const key = providerModelsCacheKey(provider)
  const hit = cached.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending

  const request = (async () => {
    try {
      const raw = await callHost<unknown>('list_ai_model_provider_models', { provider })
      const live = normalizeListedProviderModels(raw)
      const listed = live.length > 0 ? live : fallback
      cached.set(key, listed)
      failed.delete(key)
      return listed
    } catch {
      failed.add(key)
      return fallback
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, request)
  return request
}

/** Live `/models` for a keyed or local provider. Failures and keyless hosts use the static list. */
export async function listAiModelProviderModels(provider: AiModelProvider): Promise<string[]> {
  return (await listProviderModelEntries(provider)).map((model) => model.id)
}

function liveChatModel(provider: AiModelProvider, model: ListedProviderModel): RhizomeChatModel {
  const providerId = provider.id.trim() || provider.kind
  return {
    id: `${providerId}/${model.id}`,
    providerId,
    providerKind: provider.kind,
    providerName: provider.name,
    modelId: model.id,
    displayName: model.displayName,
    label: `${provider.name} · ${model.displayName}`,
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
      const entries = await listProviderModelEntries(provider)
      for (const entry of entries) {
        const model = liveChatModel(provider, entry)
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
