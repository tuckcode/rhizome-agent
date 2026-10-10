import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '../mock-tauri'
import { callHost } from '../lib/callHost'

export const PRIME_ACTIVE_CLOSE_EVENT = 'prime-active-close-requested'

export type PrimeCloseIntent = 'stop' | 'keep_working'

/**
 * Active window close (ADR-0167): Rust prevents the hide/quit and asks here.
 * Default is Stop and close. Keep working promotes, then detaches.
 * finish_main_window_close hides only when Keep in taskbar is on.
 */
export function usePrimeActiveClose() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/event')
      .then(({ listen }) => listen(PRIME_ACTIVE_CLOSE_EVENT, () => {
        setOpen(true)
      }))
      .then((fn) => {
        if (cancelled) {
          fn()
          return
        }
        unlisten = fn
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  const settleAndFinish = useCallback(async (intent: PrimeCloseIntent) => {
    await callHost('settle_prime_session', { intent })
    setOpen(false)
    await callHost('finish_main_window_close')
  }, [])

  const stopAndClose = useCallback(() => {
    void settleAndFinish('stop')
  }, [settleAndFinish])

  const keepWorking = useCallback(() => {
    void settleAndFinish('keep_working')
  }, [settleAndFinish])

  const cancel = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, stopAndClose, keepWorking, cancel }
}
