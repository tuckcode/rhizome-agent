/**
 * How big the burst thinks the window is.
 *
 * Its own module because the answer is not obvious — see the fallback below —
 * and because a component file that also exports helpers breaks fast refresh.
 */

import type { ConfettiSurfaceSize } from './confettiRenderer'

export function surfaceSize(canvas: HTMLCanvasElement, view: Window): ConfettiSurfaceSize {
  const rect = canvas.getBoundingClientRect()
  // The window, not the element, when the element measures nothing.
  //
  // A canvas measured before first layout — or while the document is hidden,
  // where the engine skips layout and every rect reads zero — would otherwise
  // initialise the surface at 1x1. The observer corrects it once a real size
  // arrives, but a burst fired in between would render into a pixel.
  const width = rect.width > 0 ? rect.width : view.innerWidth
  const height = rect.height > 0 ? rect.height : view.innerHeight
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    // Capped: a 3x backing store for decorative paper costs real memory and
    // buys nothing anyone can see.
    devicePixelRatio: Math.min(view.devicePixelRatio || 1, 2),
  }
}
