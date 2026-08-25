/**
 * Prime's steering / follow-up queue, as `get_queue` reports it.
 *
 * Previews, not the full prompt body. Chat used to remember follow-ups
 * locally because we had no read; Prime has owned the queue all along.
 */

export interface PrimeQueue {
  steering: string[]
  followUp: string[]
}

export const EMPTY_PRIME_QUEUE: PrimeQueue = { steering: [], followUp: [] }

export type PrimeQueueLane = 'steer' | 'followUp'

export interface PrimeQueueItem {
  lane: PrimeQueueLane
  text: string
  /** Stable within one snapshot — index in that lane, oldest first. */
  index: number
}

export function normalizePrimeQueue(value: PrimeQueue | null | undefined): PrimeQueue {
  return {
    steering: stringPreviews(value?.steering),
    followUp: stringPreviews(value?.followUp),
  }
}

export function primeQueueItems(queue: PrimeQueue | null | undefined): PrimeQueueItem[] {
  const normalized = normalizePrimeQueue(queue)
  return [
    ...normalized.steering.map((text, index) => ({ lane: 'steer' as const, text, index })),
    ...normalized.followUp.map((text, index) => ({ lane: 'followUp' as const, text, index })),
  ]
}

export function primeQueueIsEmpty(queue: PrimeQueue | null | undefined): boolean {
  return primeQueueItems(queue).length === 0
}

function stringPreviews(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
}
