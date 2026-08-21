/**
 * Deciding when a persistent goal has just been finished.
 *
 * Split out and pure because the interesting part is not the rendering — it is
 * telling *finished* apart from *abandoned*. Prime's goal ends in one of
 * several ways (`long-running-agents.md`: "complete, paused, budget-limited,
 * errored, or cleared") and only one of them is worth confetti. Inferring
 * completion from the goal disappearing would celebrate the user giving up on
 * it, which is the worst possible moment for a party.
 */

export interface GoalSnapshot {
  active?: boolean
  status?: string
}

const COMPLETED = 'completed'

function isCompleted(goal: GoalSnapshot | null | undefined): boolean {
  return goal?.status?.trim().toLowerCase() === COMPLETED
}

/**
 * Whether the goal finished between these two readings.
 *
 * Edge-triggered: the band re-reads every 15 seconds and a finished goal keeps
 * reporting `completed` until it is cleared, so a level check would fire on
 * every poll. A missing `previous` — the first reading after the window opens
 * — never counts, or a goal completed while the app was closed would throw
 * confetti at launch.
 */
export function goalCompletedBetween(
  previous: GoalSnapshot | null | undefined,
  next: GoalSnapshot | null | undefined,
): boolean {
  if (!previous || !next) return false
  return isCompleted(next) && !isCompleted(previous)
}
