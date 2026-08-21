import { useCallback, useEffect, useRef, useState } from 'react'
import { callHost } from '../lib/callHost'
import { goalCompletedBetween, type GoalSnapshot } from '../lib/goalCelebration'
import type { PrimeAgentActivity } from '../components/AgentActivityBand'
import type { CelebrationReason } from '../lib/celebration'

/** How often the harness is asked what it is doing. */
export const PRIME_ACTIVITY_POLL_MS = 15_000

/**
 * Watch what the harness is doing, once for the whole app.
 *
 * This started life inside `AgentActivityBand`, which lives in `ChatHome` and
 * therefore only exists while the Chat destination is on screen. That was fine
 * for a band that only renders there — and wrong the moment anything *else*
 * needed to know, because a goal completing while the user is reading notes is
 * exactly the case worth noticing. Hoisted here and mounted once at the app
 * level, so the band became a consumer rather than the owner.
 *
 * Deliberately one poller, not two: `docs/HANDOFF.md`'s architecture review
 * warns that this surface already has more pollers than producers, each taking
 * the same host lock.
 */
export function usePrimeAgentActivity({
  enabled,
  celebrate,
  pollMs = PRIME_ACTIVITY_POLL_MS,
}: {
  enabled: boolean
  /** Asked to celebrate a goal that finished; refusal is the gate's business. */
  celebrate?: (reason: CelebrationReason) => boolean
  pollMs?: number
}): { activity: PrimeAgentActivity | null; refresh: () => Promise<void> } {
  const [activity, setActivity] = useState<PrimeAgentActivity | null>(null)
  // The previous reading, in a ref so a completion is noticed between two
  // polls rather than between two renders.
  const lastGoalRef = useRef<GoalSnapshot | null | undefined>(undefined)
  // Held in a ref so the poll effect does not restart every time the caller
  // hands over a new closure; written in an effect rather than during render,
  // which is not a legal place to touch one.
  const celebrateRef = useRef(celebrate)
  useEffect(() => {
    celebrateRef.current = celebrate
  }, [celebrate])

  const receive = useCallback((next: PrimeAgentActivity | null) => {
    const nextGoal = next?.goal
    if (goalCompletedBetween(lastGoalRef.current, nextGoal)) {
      celebrateRef.current?.('goal-completed')
    }
    lastGoalRef.current = nextGoal
    setActivity(next)
  }, [])

  const read = useCallback(async () => {
    try {
      receive(await callHost<PrimeAgentActivity>('get_prime_agent_activity'))
    } catch {
      // The host may not be up yet. Staying quiet is right: this is ambient
      // state, and an error strip for it would be noise.
      //
      // The last goal reading is *kept* rather than cleared: a dropped poll is
      // not the goal changing, and forgetting it would make the next
      // successful read look like a first sighting and swallow a completion.
      setActivity(null)
    }
  }, [receive])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      await read()
    }
    void tick()
    const id = window.setInterval(() => void tick(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled, pollMs, read])

  return { activity: enabled ? activity : null, refresh: read }
}
