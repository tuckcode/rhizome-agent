import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ConfettiCannon } from './ConfettiCannon'
import { CelebrationToast } from './CelebrationToast'
import { CelebrationContext, type CelebrationDetails } from './celebrationContext'
import {
  decideCelebration,
  initialCelebrationGateState,
  type CelebrationGateState,
  type CelebrationReason,
} from '../lib/celebration'
import { onCelebrationRequested } from '../lib/celebrationEvents'
import { prefersReducedMotion } from '../lib/reducedMotion'
import type { AppLocale } from '../lib/i18n'
import { trackCelebration } from '../lib/productAnalytics'

/**
 * Owns the one cannon and the one gate.
 *
 * Every source asks `celebrate(reason)` and gets a boolean back; none of them
 * knows whether a burst happened for their reason, someone else's, or not at
 * all. That is the point — the decision lives in one place, so a new trigger
 * cannot accidentally bypass the cooldown or the setting by rendering its own
 * canvas.
 */

/** How long the agent's words stay on screen. */
export const CELEBRATION_TOAST_MS = 4_500

export interface CelebrationProviderProps {
  children: ReactNode
  /** The user's setting. Absent while settings are still loading. */
  enabled?: boolean
  locale?: AppLocale
}

export function CelebrationProvider({ children, enabled = true, locale }: CelebrationProviderProps) {
  const [fireKey, setFireKey] = useState(0)
  const [toast, setToast] = useState<CelebrationDetails | null>(null)
  // A ref, not state: the gate is read and written inside one call and must
  // not wait for a render to take effect, or two sources firing in the same
  // tick would both see an empty gate and both get through.
  const gateRef = useRef<CelebrationGateState>(initialCelebrationGateState)

  const celebrate = useCallback(
    (reason: CelebrationReason, details?: CelebrationDetails) => {
      const decision = decideCelebration({
        state: gateRef.current,
        reason,
        now: Date.now(),
        enabled,
        reducedMotion: prefersReducedMotion(),
      })
      gateRef.current = decision.state

      trackCelebration({ reason, shown: decision.celebrate, refusal: decision.refusal })
      if (!decision.celebrate) return false

      setFireKey((key) => key + 1)
      // Only when the celebration actually happened. A refusal is silent in
      // both halves: showing the words while suppressing the confetti would
      // turn a cooldown into a second, quieter celebration.
      const message = details?.message?.trim()
      setToast(message ? { message, from: details?.from?.trim() || undefined } : null)
      return true
    },
    [enabled],
  )

  // The agent's own requests arrive here, through the same gate as everything
  // else. `message` and `from` are accepted and currently unused: there is no
  // toast surface in this app yet, and confetti alone is a complete answer.
  useEffect(() => onCelebrationRequested((details) => {
    celebrate('agent', details)
  }), [celebrate])

  // Long enough to read a line, short enough that it is gone before the last
  // confetti lands. Matches what Cursor gives its own celebration toast.
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), CELEBRATION_TOAST_MS)
    return () => window.clearTimeout(id)
  }, [toast])

  const value = useMemo(() => ({ celebrate, enabled }), [celebrate, enabled])

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      <ConfettiCannon fireKey={fireKey} enabled={enabled} />
      {toast ? (
        <CelebrationToast
          message={toast.message ?? ''}
          from={toast.from}
          locale={locale}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </CelebrationContext.Provider>
  )
}
