/**
 * The agent asking for a celebration, from wherever it reaches the app.
 *
 * A browser event rather than a direct call because the two ends sit on
 * opposite sides of the tree: the WebSocket that carries the agent's request
 * is subscribed in `App`, while the gate that decides what to do about it
 * lives in a provider `App` renders. Mirrors `gitignoredVisibilityEvents`,
 * which exists for the same shape of problem.
 */

export const CELEBRATION_REQUESTED_EVENT = 'rhizome:celebration-requested'

export interface CelebrationRequestDetail {
  /** A one-line congratulation, if the agent sent one. */
  message?: string
  /** Who is celebrating, e.g. the agent's name. */
  from?: string
}

export type CelebrationRequestedEvent = CustomEvent<CelebrationRequestDetail>

/** Ask for a celebration. Whether one happens is the gate's decision. */
export function requestCelebration(detail: CelebrationRequestDetail = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CELEBRATION_REQUESTED_EVENT, { detail }))
}

/** Listen for celebration requests. Returns an unsubscribe. */
export function onCelebrationRequested(
  handler: (detail: CelebrationRequestDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (event: Event) => {
    handler((event as CelebrationRequestedEvent).detail ?? {})
  }
  window.addEventListener(CELEBRATION_REQUESTED_EVENT, listener)
  return () => window.removeEventListener(CELEBRATION_REQUESTED_EVENT, listener)
}
