export const TRANSCRIPT_HIT_TEST_ID = 'transcript-search-hit'

export function transcriptHitAnchorProps(
  index: number | undefined,
  focused: number | null | undefined,
): {
  'data-transcript-index'?: number
  'data-transcript-hit'?: 'true'
  'data-testid'?: typeof TRANSCRIPT_HIT_TEST_ID
  style: { outline?: string; outlineOffset?: number }
} {
  if (typeof index !== 'number') return { style: {} }
  const highlighted = index === focused
  return {
    'data-transcript-index': index,
    ...(highlighted
      ? {
          'data-transcript-hit': 'true' as const,
          'data-testid': TRANSCRIPT_HIT_TEST_ID,
        }
      : {}),
    style: highlighted
      ? { outline: '2px solid var(--accent-blue)', outlineOffset: 2 }
      : {},
  }
}

export function applyTranscriptHitScroll(
  container: ParentNode | null | undefined,
  focusedTranscriptIndex: number | null | undefined,
  followingRef: { current: boolean },
): boolean {
  if (typeof focusedTranscriptIndex !== 'number') return false
  followingRef.current = false
  container?.querySelector<HTMLElement>(
    `[data-transcript-index="${focusedTranscriptIndex}"]`,
  )?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

export function afterPaint(fn: () => void): void {
  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(fn)
  else fn()
}
