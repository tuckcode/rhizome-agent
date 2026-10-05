import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { afterPaint, applyTranscriptHitScroll } from '../lib/sessionTranscriptHit'

/**
 * Scroll the focused session-search turn into view. Returns whether a hit is
 * focused so the follow-the-stream scroller can stand down.
 */
export function useScrollToTranscriptHit(
  containerRef: RefObject<HTMLElement | null>,
  focusedTranscriptIndex: number | null | undefined,
  followingRef: MutableRefObject<boolean>,
  updateScrollState: () => void,
  transcript: unknown,
): boolean {
  const focused = typeof focusedTranscriptIndex === 'number'
  useEffect(() => {
    if (!focused) return
    applyTranscriptHitScroll(containerRef.current, focusedTranscriptIndex, followingRef)
    afterPaint(updateScrollState)
  }, [containerRef, focused, focusedTranscriptIndex, followingRef, transcript, updateScrollState])
  return focused
}
