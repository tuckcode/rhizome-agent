import { useEffect, useRef } from 'react'
import { readConfettiColors } from '../lib/confettiColors'
import { prefersReducedMotion } from '../lib/reducedMotion'
import {
  createConfettiRenderer,
  type ConfettiContext,
  type ConfettiRenderer,
  type ConfettiSurfaceSize,
} from '../lib/confettiRenderer'

/**
 * A full-window canvas that fires confetti when `fireKey` changes.
 *
 * Mounted once and left there. It paints nothing until something celebrates,
 * schedules no frames while idle, and never takes the pointer — a celebration
 * that swallows a click on the thing you just finished would be a poor
 * reward.
 *
 * `fireKey` rather than an imperative handle: the trigger is then plain React
 * state owned by whoever decides a celebration happened, and the same value
 * re-rendering for any other reason cannot fire a second burst.
 */

function surfaceSize(canvas: HTMLCanvasElement, view: Window): ConfettiSurfaceSize {
  const rect = canvas.getBoundingClientRect()
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    // Capped: a 3x backing store for decorative paper costs real memory and
    // buys nothing anyone can see.
    devicePixelRatio: Math.min(view.devicePixelRatio || 1, 2),
  }
}

interface ConfettiHost {
  burst(colors: string[]): void
  resize(size: ConfettiSurfaceSize): void
  dispose(): void
}

/**
 * Prefer a worker owning the canvas; fall back to the main thread.
 *
 * The fallback is not a nicety. `transferControlToOffscreen` is missing in
 * older WebKit, and `mock-tauri` runs this same code in a plain browser during
 * tests — a celebration that throws on an unsupported engine would take the
 * window down with it.
 */
function createHost(canvas: HTMLCanvasElement, view: Window): ConfettiHost | null {
  if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker === 'function') {
    try {
      const worker = new Worker(new URL('./confetti.worker.ts', import.meta.url), {
        type: 'module',
      })
      const offscreen = canvas.transferControlToOffscreen()
      worker.postMessage({ type: 'initialize', canvas: offscreen, size: surfaceSize(canvas, view) }, [
        offscreen,
      ])
      return {
        burst: (colors) => worker.postMessage({ type: 'burst', colors }),
        resize: (size) => worker.postMessage({ type: 'resize', size }),
        dispose: () => {
          worker.postMessage({ type: 'dispose' })
          worker.terminate()
        },
      }
    } catch {
      // Fall through: a canvas whose control transfer failed can still be
      // drawn on directly.
    }
  }

  const context = canvas.getContext('2d')
  if (!context) return null
  const renderer: ConfettiRenderer = createConfettiRenderer(context as unknown as ConfettiContext, {
    requestFrame: (callback) => view.requestAnimationFrame(callback),
    cancelFrame: (handle) => {
      view.cancelAnimationFrame(handle)
    },
  })
  return {
    burst: (colors) => {
      renderer.burst(colors)
    },
    resize: (size) => {
      renderer.resize(size)
    },
    dispose: () => {
      renderer.dispose()
    },
  }
}

export interface ConfettiCannonProps {
  /**
   * Bump to fire. `0` means "nothing has happened yet" and never fires, so a
   * freshly opened window does not celebrate itself.
   */
  fireKey: number
  /** Set false to keep the cannon mounted but silent. */
  enabled?: boolean
}

export function ConfettiCannon({ fireKey, enabled = true }: ConfettiCannonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hostRef = useRef<ConfettiHost | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const view = canvas?.ownerDocument?.defaultView
    if (!canvas || !view || !enabled) return
    // Checked here rather than left to callers: an accessibility promise that
    // depends on every future trigger remembering to ask is not a promise.
    if (prefersReducedMotion(view)) return

    const host = createHost(canvas, view)
    hostRef.current = host
    if (!host) return

    const notifySize = () => {
      host.resize(surfaceSize(canvas, view))
    }
    notifySize()

    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(notifySize) : undefined
    observer?.observe(canvas)
    view.addEventListener('resize', notifySize)

    return () => {
      observer?.disconnect()
      view.removeEventListener('resize', notifySize)
      host.dispose()
      hostRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || fireKey <= 0) return
    const canvas = canvasRef.current
    hostRef.current?.burst(readConfettiColors(canvas ?? null))
  }, [fireKey, enabled])

  return (
    <canvas
      ref={canvasRef}
      data-testid="confetti-cannon"
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
    />
  )
}

export default ConfettiCannon
