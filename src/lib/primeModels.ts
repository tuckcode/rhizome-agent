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

/**
 * Split the catalog into what this account can actually use, and what it
 * cannot.
 *
 * Prime publishes its whole catalog regardless of auth state. Measured on one
 * machine: **501 models, of which 105 belong to `prime-inference` — a provider
 * the user had never signed into.** A fifth of the list was unusable and
 * indistinguishable from the rest, which is most of why the picker reads as a
 * wall (#45).
 *
 * Unconnected models are separated rather than hidden. Hiding them would make
 * "why can't I find X?" unanswerable, and connecting a provider is a thing the
 * user might reasonably want to discover.
 *
 * `connected` empty means we could not determine credentials — not that
 * nothing is connected. Everything is then treated as available, matching the
 * backend's refusal to guess (`preflight::check_provider_connected`): a picker
 * that wrongly greys out a working model is worse than one that greys out
 * nothing.
 */
export function partitionModelsByConnection(
  models: PrimeModel[],
  connected: string[],
): { available: PrimeModel[]; unavailable: PrimeModel[] } {
  if (connected.length === 0) return { available: models, unavailable: [] }
  const known = new Set(connected.map((provider) => provider.trim()).filter(Boolean))
  const available: PrimeModel[] = []
  const unavailable: PrimeModel[] = []
  for (const model of models) {
    ;(known.has(model.provider?.trim()) ? available : unavailable).push(model)
  }
  return { available, unavailable }
}

/**
 * Narrow the list by a free-text query over provider, name and id.
 *
 * A blank query returns everything rather than nothing — the filter is a way
 * through a long list, not a gate in front of it.
 */
export function filterModels(models: PrimeModel[], query: string): PrimeModel[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return models
  return models.filter((model) =>
    [model.provider, model.name, model.id]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(needle)),
  )
}

/**
 * The key an allow-list entry stores: exactly the pair `set_prime_model`
 * needs, so a stored key can be turned back into a switch.
 *
 * Prime's ids already contain slashes (`google/gemma-4-31b-it:free`), so this
 * is a join, never something to split back apart — read the model, not the key.
 */
export function modelKey(model: Pick<PrimeModel, 'provider' | 'id'>): string {
  return `${model.provider}/${model.id}`
}

/**
 * Split the catalog by the user's curated allow-list (#45).
 *
 * The motivating case is a user who wants their menu to be OpenRouter's free
 * models and nothing else. Prime publishes 501 models and no price field, so a
 * hand-picked list is the only mechanism that is actually reliable — a
 * "free only" filter can be nothing better than a guess at naming conventions.
 *
 * Hidden models are separated, not dropped, the way
 * {@link partitionModelsByConnection} separates unconnected ones: they render
 * under a disclosure so "why can't I find X?" stays answerable, and the filter
 * box still reaches them.
 *
 * Two refusals, both guarding the same failure — a menu with nothing in it:
 *
 * - An empty list means *never curated*, not "curated down to zero". The Rust
 *   side normalizes `[]` back to absent for the same reason.
 * - A list that matches no live model shows everything. Prime's catalog
 *   changes underneath a saved list, and a picker that empties itself because
 *   every key went stale gives the user no way back from inside the picker.
 *
 * `activeKey` keeps whatever is running now visible even when it was never
 * listed, so the menu always contains the model the label is showing.
 */
export function partitionModelsByAllowList(
  models: PrimeModel[],
  allowList: string[],
  activeKey?: string | null,
): { shown: PrimeModel[]; hidden: PrimeModel[] } {
  const allowed = new Set(allowList.map((key) => key.trim()).filter(Boolean))
  if (allowed.size === 0) return { shown: models, hidden: [] }

  const active = activeKey?.trim()
  const isShown = (model: PrimeModel) => {
    const key = modelKey(model)
    return allowed.has(key) || (!!active && key === active)
  }

  const shown = models.filter(isShown)
  if (shown.length === 0) return { shown: models, hidden: [] }
  return { shown, hidden: models.filter((model) => !isShown(model)) }
}
