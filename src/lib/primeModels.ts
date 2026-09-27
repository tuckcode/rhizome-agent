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
  /**
   * Input modalities Prime reports, e.g. `['text', 'image']`. Absent when
   * Prime did not say — which is not the same as text-only.
   */
  input?: string[] | null
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
 * models and nothing else. The allow-list is still the curated shortlist. A
 * free-only cut sits on top of it: an explicit host `free` flag when Prime
 * sends one, then the marks Prime actually prints: `:free` or `/free` on
 * OpenRouter, `-free` on OpenCode. NVIDIA NIM is its own key. It is absent
 * from this machine's catalog when `NVIDIA_API_KEY` is not in auth. NIM ids
 * do not use `:free`. OpenRouter still has a paid/free twin for some Nemotron
 * rows.
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

/**
 * Resolve the chip's label back to a model key.
 *
 * The picker is handed a label, not a pair: `usePrimeHostStatus` reduces the
 * running model to `modelName || modelId` before the chip sees it. Matching on
 * both is enough to keep the running model out of the hidden bucket, and
 * failing to match is harmless — the label still renders, and the menu is one
 * disclosure away from the model.
 */
export function activeModelKey(models: PrimeModel[], label?: string | null): string | null {
  const needle = label?.trim()
  if (!needle) return null
  const match = models.find((model) => model.name?.trim() === needle || model.id?.trim() === needle)
  return match ? modelKey(match) : null
}

/**
 * Whether a model takes images, as far as we can tell.
 *
 * Three states, not two, and the third is the point: `null` means Prime did
 * not report modalities for this model, and silence is not a refusal. The
 * composer treats `null` the way `partitionModelsByConnection` treats unknown
 * credentials — offer the thing and say nothing, because a warning that cries
 * wolf on a working setup gets scrolled past, and is then worth less than
 * nothing.
 */
export function modelAcceptsImages(model: PrimeModel | null | undefined): boolean | null {
  const input = model?.input
  if (!input || input.length === 0) return null
  return input.some((modality) => modality.trim().toLowerCase() === 'image')
}

/** The model a live host says it is running, out of a fetched catalog. */
export function findModel(
  models: PrimeModel[],
  provider: string | null | undefined,
  id: string | null | undefined,
): PrimeModel | null {
  const wantedProvider = provider?.trim()
  const wantedId = id?.trim()
  if (!wantedProvider || !wantedId) return null
  return (
    models.find((model) => model.provider === wantedProvider && model.id === wantedId) ?? null
  )
}

/**
 * Name match for the quick filter. Prime's catalog has no price field.
 *
 * An id matches when it contains `:free` or ends with `-free`, on any
 * provider. OpenRouter's free router id is `openrouter/free`, which has
 * neither mark, so that one id is included by name as well. A display name
 * that says "free" does not match. This is not a price.
 */
export function isFreeCatalogModel(model: PrimeModel): boolean {
  const id = model.id.trim().toLowerCase()
  if (id.includes(':free') || id.endsWith('-free')) return true
  const provider = model.provider.trim().toLowerCase()
  if (provider === 'openrouter' && (id === 'free' || id.endsWith('/free'))) return true
  return false
}

/**
 * Second cut after the allow-list. `keepKey` is the running `provider/id` so
 * a paid model that is already selected stays visible when Free only is on.
 */
export function partitionModelsByFree(
  models: PrimeModel[],
  freeOnly: boolean,
  keepKey?: string | null,
): { shown: PrimeModel[]; hidden: PrimeModel[] } {
  if (!freeOnly) return { shown: models, hidden: [] }
  const keep = keepKey?.trim() ?? ''
  const shown: PrimeModel[] = []
  const hidden: PrimeModel[] = []
  for (const model of models) {
    if (isFreeCatalogModel(model) || (keep && modelKey(model) === keep)) {
      shown.push(model)
    } else {
      hidden.push(model)
    }
  }
  return { shown, hidden }
}

/**
 * Checkbox state for a provider check-all over the current catalog slice.
 *
 * The click toggles every model of that provider in the Free-only-aware
 * catalog, not the search hits. The box must describe that same set, or a
 * narrowed query looks fully selected when a sibling is still off.
 */
export function providerSelectionState(
  models: PrimeModel[],
  selection: ReadonlySet<string>,
): boolean | 'indeterminate' {
  if (models.length === 0) return false
  let selected = 0
  for (const model of models) {
    if (selection.has(modelKey(model))) selected += 1
  }
  if (selected === 0) return false
  if (selected === models.length) return true
  return 'indeterminate'
}
