import type { ReactNode } from 'react'
import { PrimeActivityContext } from './primeActivityContext'
import { usePrimeAgentActivity } from '../hooks/usePrimeAgentActivity'
import { useCelebration } from './celebrationContext'

/**
 * Mounts the single harness poll and shares its reading.
 *
 * Placed inside `CelebrationProvider` so a goal that finishes can ask for a
 * celebration — the two are separate concerns joined here rather than in
 * either one of them.
 */
export function PrimeActivityProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}) {
  const { celebrate } = useCelebration()
  const value = usePrimeAgentActivity({ enabled, celebrate })

  return <PrimeActivityContext.Provider value={value}>{children}</PrimeActivityContext.Provider>
}
