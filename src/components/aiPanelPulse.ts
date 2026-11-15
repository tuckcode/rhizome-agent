import type { CSSProperties } from 'react'

/**
 * Frame style for the AI panel's left indicator border.
 *
 * The border is 2px in the brand color while a turn runs. It does not
 * move. The border pulsed for the whole length of a turn until the run
 * status line arrived (ADR-0193). The status line now says what the run
 * does, in words, and one moving mark is enough.
 *
 * Lives outside AiPanel.tsx so it can be tested without mounting the panel and
 * its whole controller stack.
 */
export function aiPanelFrameStyle(
  isActive: boolean,
  showLeftBorder: boolean,
): CSSProperties {
  return {
    outline: 'none',
    borderLeft: showLeftBorder
      ? isActive
        ? '2px solid var(--primary)'
        : '1px solid var(--border)'
      : undefined,
  }
}
