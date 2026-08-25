import { useCallback, useEffect, useState } from 'react'
import { callHost } from '../lib/callHost'
import { trackPrimeQueueCleared } from '../lib/productAnalytics'
import {
  EMPTY_PRIME_QUEUE,
  normalizePrimeQueue,
  type PrimeQueue,
} from '../lib/primeQueue'

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
      .then((next) => setQueue(normalizePrimeQueue(next)))
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

  return {
    queue: enabled ? queue : EMPTY_PRIME_QUEUE,
    refresh,
    clear,
  }
}
