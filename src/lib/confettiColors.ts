/**
 * Where a burst gets its colours.
 *
 * Split from the component so the palette can be read and tested on its own —
 * and because a component file that also exports helpers breaks fast refresh.
 */

/**
 * Theme tokens the burst is coloured from, so it belongs to the app rather
 * than arriving from some other product's brand palette. Read at fire time,
 * not at mount: the user can change theme between celebrations.
 */
const CONFETTI_COLOR_TOKENS = [
  '--accent-blue',
  '--accent-green',
  '--accent-yellow',
  '--accent-purple',
  '--accent-red',
  '--accent-blue-light',
] as const

/** Used only if the theme yields nothing readable. */
const FALLBACK_COLORS = ['#38bdf8', '#36d399', '#ffb703', '#8b5cf6', '#ff4d6d', '#f472b6']

export function readConfettiColors(element: Element | null): string[] {
  if (!element || typeof getComputedStyle !== 'function') return FALLBACK_COLORS
  const styles = getComputedStyle(element)
  const colors = CONFETTI_COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter(
    (value) => value.length > 0,
  )
  return colors.length > 0 ? colors : FALLBACK_COLORS
}
