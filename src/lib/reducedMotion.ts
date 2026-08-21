/**
 * Whether the user has asked the system to reduce motion.
 *
 * Nothing in this app consulted `prefers-reduced-motion` before confetti
 * existed, which was fine while nothing moved on its own. A full-window
 * particle burst is exactly the case the setting is for — for some people
 * that class of animation causes nausea or migraine, not mild annoyance.
 *
 * Defaults to **false** when the query cannot be run (no `matchMedia`, as in
 * jsdom): treating an unknown as "reduce motion" would silently disable an
 * effect the user asked for on every engine that cannot answer.
 */
export function prefersReducedMotion(view: Window | null | undefined = globalThis.window): boolean {
  if (!view || typeof view.matchMedia !== 'function') return false
  try {
    return view.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
