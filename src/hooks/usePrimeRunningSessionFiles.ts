import { useCallback, useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import {
  runningSessionFilesByPath,
  type PrimeRosterSession,
} from '../lib/primeRunningSessions'

/** How often to re-ask while the session list is on screen. */
const POLL_INTERVAL_MS = 4000

const NOTHING_RUNNING: ReadonlyMap<string, boolean> = new Map()

/**
 * Which session logs the daemon is still holding, keyed by path.
 *
 * The session list is read off **disk** and cannot know what is running; the
 * roster knows what is running and is not a history. This is the bridge, and
 * the join is the log path. Keeping them separate is deliberate — conflating
 * them is a mistake this repo has made before.
 *
 * Polls only while `enabled`, which is while the sessions column is open. A
 * column nobody is looking at must not hold a 4-second timer, and this is the
 * second poll in the window already.
 *
 * Failures keep whatever was last known rather than blanking every dot: the
 * daemon being unreachable is ordinary, and "we cannot tell right now" is
 * better shown as the last answer than as "everything is dead".
 */
export function usePrimeRunningSessionFiles(enabled: boolean): ReadonlyMap<string, boolean> {
  const [running, setRunning] = useState<ReadonlyMap<string, boolean>>(NOTHING_RUNNING)
  // Guards overlapping polls: a slow roster call must not stack up behind the
  // interval and deliver its answers out of order.
  const inFlight = useRef(false)

  const refresh = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    void (async () => {
      try {
        const roster = await callHost<PrimeRosterSession[]>('list_prime_running_sessions')
        setRunning(runningSessionFilesByPath(roster))
      } catch {
        // Best-effort: keep the last known answer.
      } finally {
        inFlight.current = false
      }
    })()
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, refresh])

  return enabled ? running : NOTHING_RUNNING
}
