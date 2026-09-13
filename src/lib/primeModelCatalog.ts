import { callHost } from './callHost'
import type { PrimeModel } from './primeModels'

let catalog: PrimeModel[] | null = null
let inflight: Promise<PrimeModel[]> | null = null
let epoch = 0
const resetListeners = new Set<() => void>()

export function peekPrimeModelCatalog(): PrimeModel[] | null {
  return catalog
}

export function resetPrimeModelCatalog(): void {
  catalog = null
  inflight = null
  epoch += 1
  for (const listener of resetListeners) listener()
}

/** Settings surfaces that already loaded the catalog re-fetch after a reset. */
export function onPrimeModelCatalogReset(listener: () => void): () => void {
  resetListeners.add(listener)
  return () => {
    resetListeners.delete(listener)
  }
}

/**
 * Prime's catalog is a daemon round-trip of hundreds of models. Settings and
 * the Chat picker both need it; fetching it twice on one click is what made
 * Settings hitch. One in-flight request, then a memory of the answer.
 *
 * A failure is not cached. The host is often still starting, and remembering
 * "Prime session host is not running" would lock the menu on a lie.
 */
export async function loadPrimeModelCatalog(): Promise<PrimeModel[]> {
  if (catalog) return catalog
  if (inflight) return inflight
  const started = epoch
  inflight = callHost<PrimeModel[]>('get_available_prime_models')
    .then((listed) => {
      const next = Array.isArray(listed) ? listed : []
      if (started !== epoch) return next
      catalog = next
      return catalog
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
