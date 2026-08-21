/**
 * Whether a celebration actually happens.
 *
 * Two things can decide a milestone was reached: the app noticing an event it
 * can verify (a goal completed), and Prime deciding the work it just finished
 * was worth marking. Both are legitimate, and both can fire for the *same*
 * milestone seconds apart — the agent celebrating landing the fix, the goal
 * event celebrating the goal that fix completed. Two bursts back to back does
 * not read as twice the achievement; it reads as a bug, and after a week of it
 * the effect is wallpaper.
 *
 * So neither source fires the cannon. Both ask here, and this refuses when the
 * user has turned celebrations off, when the system asks for reduced motion,
 * or when something already celebrated recently.
 *
 * Pure: state in, decision and next state out. The provider owns the state.
 */

/**
 * How long the gate stays shut after a celebration.
 *
 * Long enough to swallow a second source noticing the same milestone, short
 * enough that two genuinely separate achievements in one working session both
 * get marked. A minute is the wrong order of magnitude for "the same thing
 * happening twice" only if a person can finish two milestones inside it.
 */
export const CELEBRATION_COOLDOWN_MS = 60_000

/** Where a celebration came from. Kept open — sources will be added. */
export type CelebrationReason = 'goal-completed' | 'first-vault' | 'agent'

/** Why a celebration did not happen. */
export type CelebrationRefusal = 'disabled' | 'reduced-motion' | 'cooldown'

export interface CelebrationGateState {
  lastCelebratedAt: number
  lastReason: CelebrationReason | null
}

export const initialCelebrationGateState: CelebrationGateState = {
  lastCelebratedAt: 0,
  lastReason: null,
}

export interface CelebrationRequest {
  state: CelebrationGateState
  reason: CelebrationReason
  now: number
  enabled: boolean
  reducedMotion: boolean
  cooldownMs?: number
}

export interface CelebrationDecision {
  celebrate: boolean
  state: CelebrationGateState
  refusal?: CelebrationRefusal
}

export function decideCelebration({
  state,
  reason,
  now,
  enabled,
  reducedMotion,
  cooldownMs = CELEBRATION_COOLDOWN_MS,
}: CelebrationRequest): CelebrationDecision {
  if (!enabled) return { celebrate: false, state, refusal: 'disabled' }
  if (reducedMotion) return { celebrate: false, state, refusal: 'reduced-motion' }

  // Note the refused attempt does not update `lastCelebratedAt`. Extending the
  // window on every refusal would let a chatty source hold the gate shut
  // indefinitely without a single burst ever being shown.
  const sinceLast = now - state.lastCelebratedAt
  if (state.lastCelebratedAt > 0 && sinceLast < cooldownMs) {
    return { celebrate: false, state, refusal: 'cooldown' }
  }

  return { celebrate: true, state: { lastCelebratedAt: now, lastReason: reason } }
}

/**
 * Celebrations are on unless turned off.
 *
 * Cursor ships its equivalent off, behind an experiment flag, because it goes
 * to millions of people including enterprises where surprise animation is a
 * support ticket. That reasoning does not transfer: a default-off toggle is
 * where a feature nobody is sure about goes to be unseen. The discipline lives
 * in the trigger list and the cooldown instead — and `prefers-reduced-motion`
 * suppresses it regardless of this setting.
 */
export const celebrationsEnabledDefault = true

/** Read the persisted setting, which is absent until someone changes it. */
export function readCelebrationsEnabled(stored: boolean | null | undefined): boolean {
  return typeof stored === 'boolean' ? stored : celebrationsEnabledDefault
}
