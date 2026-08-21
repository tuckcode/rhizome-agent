import { createContext, useContext } from 'react'
import type { CelebrationReason } from '../lib/celebration'

export interface CelebrationDetails {
  message?: string
  from?: string
}

/**
 * The seam between "something happened" and "show confetti".
 *
 * Split from the provider so a component file exports only components, which
 * is what fast refresh needs — and so a consumer can import the hook without
 * pulling the canvas in behind it.
 */

export interface CelebrationContextValue {
  /** Returns whether this actually fired. */
  /**
   * Ask for a celebration. `details.message` is the agent's own words, shown
   * as a toast when the celebration actually happens — a refused celebration
   * shows nothing at all, message or not.
   */
  celebrate: (reason: CelebrationReason, details?: CelebrationDetails) => boolean
  enabled: boolean
}

export const CelebrationContext = createContext<CelebrationContextValue | null>(null)

/**
 * Ask for a celebration.
 *
 * Returns a no-op outside a provider rather than throwing: a celebration is
 * decoration, and a component that renders fine in a test harness without one
 * should not crash because nobody wrapped it.
 */
export function useCelebration(): CelebrationContextValue {
  return (
    useContext(CelebrationContext) ?? { celebrate: () => false, enabled: false }
  )
}
