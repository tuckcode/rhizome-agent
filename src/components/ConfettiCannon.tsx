import { useEffect, useRef } from 'react'
import { readConfettiColors } from '../lib/confettiColors'
import { surfaceSize } from '../lib/confettiSurface'
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
/**
 * Hosts already built, keyed by the canvas they own.
 *
 * Handing a canvas to a worker is one-way and permanent for that element: it
 * cannot be transferred twice, and `getContext` throws on it forever after.
 * React StrictMode mounts effects twice against the *same* node in
 * development, so without this the second pass re-entered `createHost`, failed
 * to transfer, fell through to `getContext`, and threw — a blank window with a
 * stack trace. Weak so a discarded canvas takes its host with it.
 */
const hostsByCanvas = new WeakMap<HTMLCanvasElement, ConfettiHost>()

function createHost(canvas: HTMLCanvasElement, view: Window): ConfettiHost | null {
  const existing = hostsByCanvas.get(canvas)
  if (existing) return existing

  if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker === 'function') {
    try {
      const worker = new Worker(new URL('./confetti.worker.ts', import.meta.url), {
        type: 'module',
      })
      const offscreen = canvas.transferControlToOffscreen()
      worker.postMessage({ type: 'initialize', canvas: offscreen, size: surfaceSize(canvas, view) }, [
        offscreen,
      ])
      const host: ConfettiHost = {
        burst: (colors) => worker.postMessage({ type: 'burst', colors }),
        resize: (size) => worker.postMessage({ type: 'resize', size }),
        dispose: () => {
          worker.postMessage({ type: 'dispose' })
          worker.terminate()
          hostsByCanvas.delete(canvas)
        },
      }
      hostsByCanvas.set(canvas, host)
      return host
    } catch {
      // Fall through: a canvas whose control transfer failed can still be
      // drawn on directly.
    }
  }

  // Guarded: on a canvas whose control was already transferred this does not
  // return null, it throws.
  let context: CanvasRenderingContext2D | null = null
  try {
    context = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!context) return null
  const renderer: ConfettiRenderer = createConfettiRenderer(context as unknown as ConfettiContext, {
    requestFrame: (callback) => view.requestAnimationFrame(callback),
    cancelFrame: (handle) => {
      view.cancelAnimationFrame(handle)
    },
  })
  const host: ConfettiHost = {
    burst: (colors) => {
      renderer.burst(colors)
    },
    resize: (size) => {
      renderer.resize(size)
    },
    dispose: () => {
      renderer.dispose()
      hostsByCanvas.delete(canvas)
    },
  }
  hostsByCanvas.set(canvas, host)
  return host
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
      // Deliberately not disposed here. This cleanup also runs on StrictMode's
      // development remount, where the same canvas comes straight back — and a
      // transferred canvas cannot be given a second host. The worker dies with
      // the window; a WeakMap entry dies with the element.
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
      // How many bursts this cannon has fired. The animation itself lives in
      // a worker-owned canvas whose pixels the page cannot read, so without
      // this there is no way for a test — or a person poking at the console —
      // to tell a working celebration from a silent one.
      data-burst-count={fireKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999]"
      // Sized explicitly because a canvas is a replaced element: `inset-0`
      // alone does not stretch it the way it stretches a div — with `width:
      // auto` it keeps its intrinsic size, which for a canvas handed to a
      // worker is whatever backing store that worker last set.
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
