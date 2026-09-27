import { useCallback, useEffect, useState } from 'react'
import { callHost } from '../lib/callHost'
import { trackPrimeQueueCleared } from '../lib/productAnalytics'
import {
  EMPTY_PRIME_QUEUE,
  normalizePrimeQueue,
  type PrimeQueue,
  type PrimeQueueLane,
} from '../lib/primeQueue'

/** Prime's daemon verb for editing one queued line. The Tauri command is `mutate_prime_queued_message`. */
export const PRIME_DAEMON_MUTATE_QUEUED_MESSAGE = 'mutate_queued_message'

export type PrimeQueueMutationStatus = 'applied' | 'rejected' | 'invalid' | 'unsupported'

export type PrimeQueueMutation =
  | { type: 'delete' }
  | { type: 'replace'; text: string }

type Listener = () => void

const mutationListeners = new Set<Listener>()
const refreshListeners = new Set<() => void>()
let mutationAvailable = false

export function primeQueueLane(lane: PrimeQueueLane): 'steering' | 'followUp' {
  return lane === 'steer' ? 'steering' : 'followUp'
}

export function primeQueueMutationAvailable(): boolean {
  return mutationAvailable
}

export function subscribePrimeQueueMutation(listener: Listener): () => void {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}

function setPrimeQueueMutationAvailable(next: boolean) {
  if (next === mutationAvailable) return
  mutationAvailable = next
  for (const listener of mutationListeners) listener()
}

export function notePrimeQueuePayload(value: unknown) {
  const canMutate = Boolean(
    value && typeof value === 'object' && 'canMutate' in value && (value as { canMutate?: boolean }).canMutate,
  )
  setPrimeQueueMutationAvailable(canMutate)
}

export function usePrimeQueueMutationAvailable(): boolean {
  const [available, setAvailable] = useState(mutationAvailable)
  useEffect(() => subscribePrimeQueueMutation(() => setAvailable(mutationAvailable)), [])
  return available
}

export function requestPrimeQueueRefresh() {
  for (const refresh of refreshListeners) refresh()
}

export async function mutatePrimeQueuedMessage(input: {
  lane: PrimeQueueLane
  index: number
  expectedText: string
  mutation: PrimeQueueMutation
}): Promise<PrimeQueueMutationStatus> {
  const lane = primeQueueLane(input.lane)
  const mutation = input.mutation.type === 'delete'
    ? { type: 'delete' as const }
    : { type: 'replace' as const, text: input.mutation.text, lane }
  try {
    const result = await callHost<{ status?: string }>('mutate_prime_queued_message', {
      lane,
      index: input.index,
      expectedText: input.expectedText,
      mutation,
    })
    const status = result?.status
    if (status === 'applied' || status === 'rejected' || status === 'invalid') return status
    if (status === 'unsupported') {
      console.warn(`[prime] ${PRIME_DAEMON_MUTATE_QUEUED_MESSAGE} is unsupported`)
      setPrimeQueueMutationAvailable(false)
      return 'unsupported'
    }
    return 'rejected'
  } catch (error) {
    console.warn(`[prime] ${PRIME_DAEMON_MUTATE_QUEUED_MESSAGE} failed:`, error)
    return 'rejected'
  }
}

/**
 * Prime's actual queue — not the messages this panel remembers sending.
 *
 * Polled while Chat is on Prime. `refreshKey` (typically "is the turn
 * running?") refetches immediately so a just-queued follow-up appears
 * without waiting for the interval.
 */
export function usePrimeQueue(
  enabled = true,
  refreshKey?: unknown,
): {
  queue: PrimeQueue
  refresh: () => void
  clear: () => Promise<void>
} {
  const [queue, setQueue] = useState<PrimeQueue>(EMPTY_PRIME_QUEUE)

  const refresh = useCallback(() => {
    if (!enabled) return
    void callHost<PrimeQueue>('get_prime_session_queue')
      .then((next) => {
        notePrimeQueuePayload(next)
        setQueue(normalizePrimeQueue(next))
      })
      .catch(() => setQueue(EMPTY_PRIME_QUEUE))
  }, [enabled])

  const clear = useCallback(async () => {
    try {
      const next = await callHost<PrimeQueue>('clear_prime_session_queue')
      setQueue(normalizePrimeQueue(next))
      trackPrimeQueueCleared()
    } catch {
      // Keep the last queue: a failed clear that blanks the list reads as
      // "the messages vanished" when they are still in Prime.
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const id = window.setInterval(refresh, 4_000)
    return () => window.clearInterval(id)
  }, [enabled, refresh, refreshKey])

  useEffect(() => {
    refreshListeners.add(refresh)
    return () => {
      refreshListeners.delete(refresh)
    }
  }, [refresh])

  return {
    queue: enabled ? queue : EMPTY_PRIME_QUEUE,
    refresh,
    clear,
  }
}
