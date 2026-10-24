import { callHost } from './callHost'

export type NativeVision = 'yes' | 'no' | 'unknown'

const cached = new Map<string, NativeVision>()
const inflight = new Map<string, Promise<NativeVision>>()

export function resetNativeVisionCache(): void {
  cached.clear()
  inflight.clear()
}

async function lookupVision(target: string): Promise<NativeVision> {
  const hit = cached.get(target)
  if (hit) return hit
  const pending = inflight.get(target)
  if (pending) return pending
  const request = (async () => {
    try {
      const value = await callHost<string>('native_model_vision', { target })
      const parsed = parseVision(value)
      cached.set(target, parsed)
      return parsed
    } catch {
      return 'unknown' as const
    } finally {
      inflight.delete(target)
    }
  })()
  inflight.set(target, request)
  return request
}

function parseVision(value: unknown): NativeVision {
  if (value === 'yes' || value === 'no' || value === 'unknown') return value
  return 'unknown'
}

export async function nativeModelVision(target: string): Promise<NativeVision> {
  return lookupVision(target)
}

/**
 * One pass over the ids the picker is showing. Repeated opens reuse the cache,
 * so a menu open does not call the host once per model again.
 */
export async function nativeModelsVision(targets: string[]): Promise<Record<string, NativeVision>> {
  const unique = [...new Set(targets.map((target) => target.trim()).filter(Boolean))]
  const missing = unique.filter((target) => !cached.has(target))
  if (missing.length > 0) {
    try {
      const batch = await callHost<Record<string, string>>('native_models_vision', { targets: missing })
      if (batch && typeof batch === 'object' && !Array.isArray(batch)) {
        for (const target of missing) {
          const value = batch[target]
          if (value === 'yes' || value === 'no' || value === 'unknown') cached.set(target, value)
        }
      }
    } catch {
      // The host may only know the single-target command. Fall through.
    }
    await Promise.all(missing.filter((target) => !cached.has(target)).map((target) => lookupVision(target)))
  }
  return Object.fromEntries(unique.map((target) => [target, cached.get(target) ?? 'unknown']))
}
