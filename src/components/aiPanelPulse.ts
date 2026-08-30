import type { CSSProperties } from 'react'
import { prefersReducedMotion } from '../lib/reducedMotion'

/**
 * Frame style for the AI panel's left indicator border.
 *
 * The running-turn pulse is an inline `animation`, not a class, so a
 * `prefers-reduced-motion` block in the stylesheet cannot switch it off — inline
 * styles win. It has to be decided here.
 *
 * `reducedMotion.ts` notes that nothing consulted the setting before confetti,
 * "which was fine while nothing moved on its own." This pulse runs `infinite`
 * for the entire length of a turn, so that stopped being true. The border colour
 * still marks the active panel when motion is reduced; only the movement stops,
 * and the status text states the same thing in words.
 *
 * Lives outside AiPanel.tsx so it can be tested without mounting the panel and
 * its whole controller stack — `aiPanelPulse.test.ts` already guarded the
 * keyframes and now covers the style decision beside them.
 */
export function aiPanelFrameStyle(
  isActive: boolean,
  showLeftBorder: boolean,
  reduceMotion: boolean = prefersReducedMotion(),
): CSSProperties {
  return {
    outline: 'none',
    borderLeft: showLeftBorder
      ? isActive
        ? '2px solid var(--accent-blue)'
        : '1px solid var(--border)'
      : undefined,
    animation:
      showLeftBorder && isActive && !reduceMotion
        ? 'ai-border-pulse 2s ease-in-out infinite'
        : undefined,
    transition: showLeftBorder && !reduceMotion ? 'border-color 0.3s ease' : undefined,
  }
}
