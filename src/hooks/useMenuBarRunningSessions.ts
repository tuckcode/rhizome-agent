import { useCallback, useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import { isTauri } from '../mock-tauri'
import {
  runningSessionOverflow,
  toRunningSessionRows,
  type PrimeRosterSession,
  type RunningSessionRow,
} from '../lib/primeRunningSessions'

/** How often the roster re-polls while the popover is on screen. */
const POLL_INTERVAL_MS = 4000

export interface MenuBarRunningSessions {
  /** Running top-level sessions, already capped for the popover. */
  rows: RunningSessionRow[]
  /** Running sessions the cap hid, for the "+N more" line. */
  overflow: number
  /** Re-fetch now (called when the popover is shown). */
  refresh: () => void
  /** Begin/stop polling. The popover only polls while it is visible. */
  setPolling: (polling: boolean) => void
}

/**
 * The menu bar's answer to "is anything working?" (#13).
 *
 * Polls rather than subscribes: the daemon's event stream is session-scoped
 * and this window is attached to no session, so there is nothing to subscribe
 * to. Polling only runs while the popover is visible — a menu-bar window that
 * is hidden 99% of the time must not hold a 4-second timer all day.
 *
 * Failures leave the previous rows in place and never surface an error. The
 * daemon being down is the ordinary case on a fresh boot, and #13 asks for
 * "nothing running" to render quietly rather than as a broken frame.
 */
export function useMenuBarRunningSessions(): MenuBarRunningSessions {
  const [rows, setRows] = useState<RunningSessionRow[]>([])
  const [overflow, setOverflow] = useState(0)
  const [polling, setPolling] = useState(false)
  // Guards against overlapping polls: a slow roster call must not stack up
  // behind the interval and deliver its answers out of order.
  const inFlight = useRef(false)

  const refresh = useCallback(() => {
    if (!isTauri()) return
    if (inFlight.current) return
    inFlight.current = true
    void (async () => {
      try {
        const roster = (await callHost('list_prime_running_sessions')) as PrimeRosterSession[]
        setRows(toRunningSessionRows(roster))
        setOverflow(runningSessionOverflow(roster))
      } catch {
        // Best-effort: keep whatever was on screen.
      } finally {
        inFlight.current = false
      }
    })()
  }, [])

  // Fetch once on mount, independently of polling: the popover is built and
  // shown in the same breath, and a first paint that waits for a focus event
  // shows an empty roster for as long as that event takes to arrive — or
  // forever, if it never does.
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!polling) return
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [polling, refresh])

  return { rows, overflow, refresh, setPolling }
}
