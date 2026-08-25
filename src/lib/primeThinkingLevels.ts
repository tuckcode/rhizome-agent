/**
 * Display helpers for Prime's reasoning levels and the strip's combined
 * model · thinking control (#9).
 *
 * Pure. The level *list* is not defined here on purpose — it comes from
 * `get_prime_thinking_levels`, which returns the host's own
 * `PRIME_THINKING_LEVELS`. #9 requires no hardcoded model or level anywhere in
 * the frontend, and a second copy of the list here is exactly the drift that
 * requirement exists to prevent. What lives here is only how to *render* a
 * level the host sent.
 */

/**
 * Human casing for a level id.
 *
 * `xhigh` is the only one that does not fall out of a capitalise: rendering it
 * as "Xhigh" reads as a typo, so it gets an explicit entry. Anything
 * unrecognised is capitalised rather than dropped — a level Prime adds later
 * should render imperfectly, not vanish from the control.
 */
const LEVEL_LABELS: Record<string, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
  max: 'Max',
}

export function thinkingLevelLabel(level: string | null | undefined): string | null {
  const normalized = (level ?? '').trim().toLowerCase()
  if (!normalized) return null
  return LEVEL_LABELS[normalized] ?? normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/**
 * The strip's one-line answer to "what am I talking to": `Grok 4.5 · High`.
 *
 * Returns just the model when there is no level yet — a session that has not
 * reported one should read as a model, not as `Grok 4.5 · ` with a dangling
 * separator. Returns null when there is no model either, so the caller can
 * render nothing rather than a bare separator.
 */
export function modelThinkingLabel(
  model: string | null | undefined,
  level: string | null | undefined,
): string | null {
  const modelLabel = (model ?? '').trim()
  const levelLabel = thinkingLevelLabel(level)
  if (!modelLabel) return null
  return levelLabel ? `${modelLabel} · ${levelLabel}` : modelLabel
}

/**
 * Endpoints for the composer one-click thinking toggle (#35).
 *
 * The host still owns the list. These ids are only how we pick a quiet
 * default and a loud default *from that list* so a click has somewhere to go
 * without opening a menu. Unknown current levels count as quiet.
 */
const QUIET_LEVEL_IDS = ['off', 'minimal', 'low'] as const
const LOUD_LEVEL_IDS = ['high', 'xhigh', 'max'] as const

function firstPresentLevel(
  levels: readonly string[],
  candidates: readonly string[],
): string | null {
  const byId = new Map(levels.map((level) => [level.trim().toLowerCase(), level.trim()]))
  for (const id of candidates) {
    const hit = byId.get(id)
    if (hit) return hit
  }
  return null
}

export function nextThinkingToggleLevel(
  current: string | null | undefined,
  levels: readonly string[],
): string | null {
  const usable = levels.map((level) => level.trim()).filter(Boolean)
  if (usable.length === 0) return null
  const quiet = firstPresentLevel(usable, QUIET_LEVEL_IDS) ?? usable[0]
  const loud = firstPresentLevel(usable, LOUD_LEVEL_IDS) ?? usable[usable.length - 1]
  const now = (current ?? '').trim().toLowerCase()
  if (LOUD_LEVEL_IDS.some((id) => id === now)) return quiet
  return loud
}

export function thinkingLevelIsLoud(current: string | null | undefined): boolean {
  const now = (current ?? '').trim().toLowerCase()
  return LOUD_LEVEL_IDS.some((id) => id === now)
}
