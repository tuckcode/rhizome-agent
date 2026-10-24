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
 * Vision for the ids the picker is showing.
 * Each id is one cached `native_model_vision` call. There is no batch command.
 */
export async function visionForTargets(targets: string[]): Promise<Record<string, NativeVision>> {
  const unique = [...new Set(targets.map((target) => target.trim()).filter(Boolean))]
  await Promise.all(unique.filter((target) => !cached.has(target)).map((target) => lookupVision(target)))
  return Object.fromEntries(unique.map((target) => [target, cached.get(target) ?? 'unknown']))
}
