/**
 * Grouping the Prime model list for the picker.
 *
 * Mirrors `PrimeModel` in `src-tauri/src/prime_session_host.rs`.
 */

export interface PrimeModel {
  id: string
  name: string
  provider: string
  contextWindow?: number | null
  reasoning?: boolean
}

export interface PrimeModelGroup {
  provider: string
  models: PrimeModel[]
}

/**
 * Group models by provider, providers alphabetical, models by name inside each.
 *
 * A live host reports ~78 models. A flat list of that length is a scroll, not a
 * choice — the provider is the first thing a user narrows by, since it is what
 * their credentials are attached to.
 */
export function groupModelsByProvider(models: PrimeModel[]): PrimeModelGroup[] {
  const byProvider = new Map<string, PrimeModel[]>()

  for (const model of models) {
    const provider = model.provider?.trim()
    if (!provider || !model.id?.trim()) continue
    const bucket = byProvider.get(provider)
    if (bucket) bucket.push(model)
    else byProvider.set(provider, [model])
  }

  return [...byProvider.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, group]) => ({
      provider,
      models: [...group].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)),
    }))
}
