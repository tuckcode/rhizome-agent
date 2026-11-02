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

export interface ListedProviderModel {
  id: string
  displayName: string
}

const cached = new Map<string, ListedProviderModel[]>()
const inflight = new Map<string, Promise<ListedProviderModel[]>>()
const failed = new Set<string>()
const failureKind = new Map<string, ProviderListFailure>()

/** A live `/models` call that is still pending after this shows Retry. */
export const MODEL_LIST_TIMEOUT_MS = 10_000

export type ProviderListFailure = 'timeout' | 'unreachable' | 'empty'

export function resetListProviderModelsCache(): void {
  cached.clear()
  inflight.clear()
  failed.clear()
  failureKind.clear()
}

export function providerListFailure(provider: Pick<AiModelProvider, 'id' | 'kind' | 'base_url'>): ProviderListFailure | null {
  return failureKind.get(providerModelsCacheKey(provider)) ?? null
}

export function cachedProviderModelLabels(provider: Pick<AiModelProvider, 'id' | 'kind' | 'base_url'>): string[] | null {
  const hit = cached.get(providerModelsCacheKey(provider))
  if (!hit) return null
  return hit.map((model) => model.displayName || model.id)
}

export function listProviderFailures(): Array<{ cacheKey: string; kind: ProviderListFailure }> {
  return [...failureKind.entries()].map(([cacheKey, kind]) => ({ cacheKey, kind }))
}

export function forgetListedProviderModels(provider: Pick<AiModelProvider, 'id' | 'kind' | 'base_url' | 'name'>): void {
  const key = providerModelsCacheKey(provider)
  cached.delete(key)
  inflight.delete(key)
  failed.delete(key)
  failureKind.delete(key)
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

export function offlineLiveProviderNames(providers?: AiModelProvider[] | null): string[] {
  return providersToListLive(providers)
    .filter((provider) => failed.has(providerModelsCacheKey(provider)))
    .map((provider) => provider.name)
}

function configuredLiveProviders(providers?: AiModelProvider[] | null): AiModelProvider[] {
  return normalizeAiModelProviders(providers).filter((provider) => {
    return provider.kind !== 'anthropic' && canListProviderModelsLive(provider)
  })
}

function localProviderAnswered(provider: AiModelProvider): boolean {
  const key = providerModelsCacheKey(provider)
  return isLocalAiProvider(provider) && cached.has(key) && !failed.has(key)
}

export function liveProviderHeadingNames(providers?: AiModelProvider[] | null): string[] {
  const names = new Set(configuredLiveProviders(providers).map((provider) => provider.name))
  for (const provider of providersToListLive(providers)) {
    if (localProviderAnswered(provider)) names.add(provider.name)
  }
  return [...names]
}

export function liveModelDisplayName(id: string, apiName?: string | null): string {
  const given = apiName?.trim()
  if (given) return given
  const last = id.split('/').filter(Boolean).pop() ?? id
  return last.replace(/:latest$/i, '')
}

export function normalizeListedProviderModels(raw: unknown): ListedProviderModel[] {
  // A string body such as "models" is not a list. Splitting it would invent
  // one-letter ids. A real id of "m" only survives when the payload is an array.
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

function rememberListFailure(key: string, kind: ProviderListFailure): void {
  failed.add(key)
  failureKind.set(key, kind)
}

function clearListFailure(key: string): void {
  failed.delete(key)
  failureKind.delete(key)
}

export function classifyListFailure(error: unknown, local: boolean): ProviderListFailure {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "Couldn't load models") return 'timeout'
  if (local && /refused|unreachable|econnrefused|failed to connect|connection|offline|network/i.test(message)) {
    return 'unreachable'
  }
  return 'timeout'
}

function withModelListTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Couldn't load models")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
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

  const slot: { current?: Promise<ListedProviderModel[]> } = {}
  const request = (async () => {
    const stillMine = () => inflight.get(key) === slot.current
    try {
      const hostCall = callHost<unknown>('list_ai_model_provider_models', { provider })
      const raw = await withModelListTimeout(hostCall, MODEL_LIST_TIMEOUT_MS)
      if (!stillMine()) return fallback
      const live = normalizeListedProviderModels(raw)
      if (live.length === 0) {
        rememberListFailure(key, 'empty')
        cached.set(key, fallback)
        return fallback
      }
      cached.set(key, live)
      clearListFailure(key)
      return live
    } catch (error) {
      if (!stillMine()) return fallback
      rememberListFailure(key, classifyListFailure(error, isLocalAiProvider(provider)))
      return fallback
    } finally {
      if (inflight.get(key) === slot.current) inflight.delete(key)
    }
  })()
  slot.current = request
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

export interface ChatgptAccountModel {
  slug: string
  displayName: string
}

/** Replaces built-in OpenAI rows with the signed-in account's models. */
export function withChatgptAccountModels(
  models: RhizomeChatModel[],
  account: ChatgptAccountModel[],
): RhizomeChatModel[] {
  if (account.length === 0) return models
  const isBuiltinOpenai = (model: RhizomeChatModel) =>
    model.providerKind === 'open_ai' && model.providerId === 'openai'
  const providerName = models.find(isBuiltinOpenai)?.providerName ?? 'OpenAI'
  const rows = account.map((model): RhizomeChatModel => ({
    id: `openai/${model.slug}`,
    providerId: 'openai',
    providerKind: 'open_ai',
    providerName,
    modelId: model.slug,
    displayName: model.displayName,
    label: `${providerName} · ${model.displayName}`,
  }))
  const others = models.filter((model) => !isBuiltinOpenai(model))
  const at = others.findIndex((model) => model.providerKind === 'free_tier')
  return at < 0 ? [...others, ...rows] : [...others.slice(0, at), ...rows, ...others.slice(at)]
}

/** Display names for the signed-in ChatGPT account. A failed list returns none. */
export async function loadChatgptAccountModelLabels(): Promise<string[]> {
  try {
    const account = await callHost<ChatgptAccountModel[]>('list_chatgpt_account_models')
    return Array.isArray(account) ? account.map((model) => model.displayName) : []
  } catch {
    return []
  }
}

/** Live models for the signed-in ChatGPT account. A failed list keeps the seed rows. */
export async function loadChatgptAccountModels(
  models: RhizomeChatModel[],
): Promise<RhizomeChatModel[]> {
  try {
    const account = await callHost<ChatgptAccountModel[]>('list_chatgpt_account_models')
    return Array.isArray(account) ? withChatgptAccountModels(models, account) : models
  } catch {
    return models
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
