import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '../mock-tauri'
import { callHost } from '../lib/callHost'

export const PRIME_ACTIVE_CLOSE_EVENT = 'prime-active-close-requested'

export type PrimeCloseIntent = 'stop' | 'keep_working'

async function hideMainWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().hide().catch(() => {})
}

/**
 * Active window close (ADR-0167): Rust prevents the hide and asks here.
 * Default is Stop and close. Keep working promotes, then detaches.
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

  const settleAndHide = useCallback(async (intent: PrimeCloseIntent) => {
    await callHost('settle_prime_session', { intent })
    setOpen(false)
    await hideMainWindow()
  }, [])

  const stopAndClose = useCallback(() => {
    void settleAndHide('stop')
  }, [settleAndHide])

  const keepWorking = useCallback(() => {
    void settleAndHide('keep_working')
  }, [settleAndHide])

  const cancel = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, stopAndClose, keepWorking, cancel }
}
