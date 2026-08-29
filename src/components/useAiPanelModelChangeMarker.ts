import { useEffect, useRef } from 'react'
import { primeModelLabel, type PrimeHostStatus } from '../hooks/usePrimeHostStatus'
import { translate, type AppLocale } from '../lib/i18n'

interface UseAiPanelModelChangeMarkerArgs {
  isPrimeTarget: boolean
  primeHost: PrimeHostStatus
  locale: AppLocale
  addLocalMarker: (text: string) => void
}

/**
 * Drops a local "model changed" marker into the transcript when the host
 * reports a different model mid-session — e.g. the user (or a scheduled
 * job) switched models on the daemon directly, outside this panel.
 *
 * A session switch is not a model change: `lastModelSession` resets the
 * baseline instead of comparing across it, so opening a different session
 * that happens to use a different model does not falsely announce a swap.
 */
export function useAiPanelModelChangeMarker({
  isPrimeTarget,
  primeHost,
  locale,
  addLocalMarker,
}: UseAiPanelModelChangeMarkerArgs): void {
  const lastModelId = useRef<string | null | undefined>(undefined)
  const lastModelSession = useRef(primeHost.sessionPath)

  useEffect(() => {
    if (!isPrimeTarget) return
    if (primeHost.sessionPath !== lastModelSession.current) {
      lastModelSession.current = primeHost.sessionPath
      lastModelId.current = primeHost.modelId ?? null
      return
    }
    const next = primeHost.modelId ?? null
    if (lastModelId.current === undefined) {
      lastModelId.current = next
      return
    }
    if (next && next !== lastModelId.current) {
      const label = primeModelLabel(primeHost) ?? next
      addLocalMarker(translate(locale, 'ai.command.modelChanged', { model: label }))
    }
    lastModelId.current = next
  }, [addLocalMarker, isPrimeTarget, locale, primeHost])
}
