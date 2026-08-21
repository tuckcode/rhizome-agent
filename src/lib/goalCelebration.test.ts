import { describe, expect, it } from 'vitest'
import { goalCompletedBetween, type GoalSnapshot } from './goalCelebration'

const active: GoalSnapshot = { active: true, status: 'active' }
const completed: GoalSnapshot = { active: false, status: 'completed' }

describe('spotting a completed goal', () => {
  it('fires on the move from working to complete', () => {
    expect(goalCompletedBetween(active, completed)).toBe(true)
  })

  /**
   * Edge, not level. The band re-reads every 15 seconds and a finished goal
   * keeps reporting `completed` until it is cleared — celebrating on the
   * state rather than the change would fire every poll for as long as the
   * goal sits there.
   */
  it('does not fire again while the goal stays complete', () => {
    expect(goalCompletedBetween(completed, completed)).toBe(false)
  })

  /**
   * A goal that vanishes was cleared, not finished. Prime distinguishes them
   * — `long-running-agents.md`: a goal ends "complete, paused, budget-limited,
   * errored, or cleared", and only `goal.complete()` marks success. Guessing
   * from absence would celebrate the user giving up.
   */
  it('stays quiet when a goal simply disappears', () => {
    expect(goalCompletedBetween(active, undefined)).toBe(false)
    expect(goalCompletedBetween(active, null)).toBe(false)
  })

  it('stays quiet for every other ending', () => {
    expect(goalCompletedBetween(active, { active: false, status: 'paused' })).toBe(false)
    expect(goalCompletedBetween(active, { active: false, status: 'failed' })).toBe(false)
  })

  /**
   * The first poll after the window opens has no previous snapshot. A goal
   * that completed while the app was closed must not celebrate on launch.
   */
  it('does not celebrate a goal that was already complete on first sight', () => {
    expect(goalCompletedBetween(undefined, completed)).toBe(false)
    expect(goalCompletedBetween(null, completed)).toBe(false)
  })

  it('fires for a second goal completed after the first', () => {
    expect(goalCompletedBetween(completed, active)).toBe(false)
    expect(goalCompletedBetween(active, completed)).toBe(true)
  })

  it('ignores case and padding, since the status is a bare string', () => {
    expect(goalCompletedBetween(active, { active: false, status: ' Completed ' })).toBe(true)
  })
})
