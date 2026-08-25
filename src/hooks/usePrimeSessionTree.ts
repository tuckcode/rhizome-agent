import { useCallback, useEffect, useState } from 'react'
import { callHost } from '../lib/callHost'
import {
  EMPTY_PRIME_SESSION_TREE,
  type PrimeSessionTree,
} from '../lib/primeSessionTree'

/**
 * Fork/branch history of the attached Prime session.
 *
 * Polled while Chat is on Prime. Must not create a session — the host
 * answers an empty tree when nothing is attached (#28).
 */
export function usePrimeSessionTree(
  enabled = true,
  refreshKey?: unknown,
): {
  tree: PrimeSessionTree
  refresh: () => void
} {
  const [tree, setTree] = useState<PrimeSessionTree>(EMPTY_PRIME_SESSION_TREE)

  const refresh = useCallback(() => {
    if (!enabled) return
    void callHost<PrimeSessionTree>('get_prime_session_tree')
      .then((next) => setTree(next ?? EMPTY_PRIME_SESSION_TREE))
      .catch(() => setTree(EMPTY_PRIME_SESSION_TREE))
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const id = window.setInterval(refresh, 4_000)
    return () => window.clearInterval(id)
  }, [enabled, refresh, refreshKey])

  return {
    tree: enabled ? tree : EMPTY_PRIME_SESSION_TREE,
    refresh,
  }
}
