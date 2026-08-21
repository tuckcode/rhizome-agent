/**
 * Owns an `OffscreenCanvas` handed over by `ConfettiCannon` and runs the
 * burst there, off the main thread.
 *
 * Deliberately thin: every decision lives in `confettiRenderer`, so the
 * worker and the main-thread fallback cannot drift into two different
 * animations. Nothing is posted back — the main thread has nothing to learn
 * from a burst in progress.
 */

import { createConfettiRenderer, type ConfettiContext, type ConfettiRenderer, type ConfettiSurfaceSize } from '../lib/confettiRenderer'

type ConfettiWorkerMessage =
  | { type: 'initialize'; canvas: OffscreenCanvas; size: ConfettiSurfaceSize }
  | { type: 'resize'; size: ConfettiSurfaceSize }
  | { type: 'burst'; colors: string[] }
  | { type: 'dispose' }

let renderer: ConfettiRenderer | null = null

function initialize(canvas: OffscreenCanvas, size: ConfettiSurfaceSize) {
  const context = canvas.getContext('2d')
  if (!context) return
  renderer?.dispose()
  renderer = createConfettiRenderer(context as unknown as ConfettiContext, {
    requestFrame: (callback) => self.requestAnimationFrame(callback),
    cancelFrame: (handle) => {
      self.cancelAnimationFrame(handle)
    },
  })
  renderer.resize(size)
}

self.onmessage = (event: MessageEvent<ConfettiWorkerMessage>) => {
  const message = event.data
  switch (message.type) {
    case 'initialize':
      initialize(message.canvas, message.size)
      return
    case 'resize':
      renderer?.resize(message.size)
      return
    case 'burst':
      renderer?.burst(message.colors)
      return
    case 'dispose':
      renderer?.dispose()
      renderer = null
      return
  }
}
