import { createContext, useContext } from 'react'
import type { PrimeAgentActivity } from './AgentActivityBand'

/**
 * What the harness is doing, produced once and read wherever it is needed.
 *
 * The band used to poll for itself, which tied "is a goal finished?" to the
 * Chat destination being on screen. One producer, many readers.
 */
export interface PrimeActivityContextValue {
  activity: PrimeAgentActivity | null
  refresh: () => Promise<void>
}

export const PrimeActivityContext = createContext<PrimeActivityContextValue | null>(null)

/**
 * Read the shared activity. Returns an empty reading outside a provider so a
 * component under test does not have to be wrapped to render.
 */
export function usePrimeActivity(): PrimeActivityContextValue {
  return useContext(PrimeActivityContext) ?? { activity: null, refresh: async () => {} }
}
