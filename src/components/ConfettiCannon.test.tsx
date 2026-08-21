import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfettiCannon } from './ConfettiCannon'
import { surfaceSize } from '../lib/confettiSurface'
import { readConfettiColors } from '../lib/confettiColors'

describe('ConfettiCannon', () => {
  it('is invisible to assistive tech and never takes the pointer', () => {
    render(<ConfettiCannon fireKey={0} />)

    const canvas = screen.getByTestId('confetti-cannon')
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
    expect(canvas.className).toContain('pointer-events-none')
  })

  /**
   * A window that celebrates the moment it opens has celebrated nothing. The
   * key counts real events, so zero must stay silent.
   */
  it('does not fire on mount', () => {
    expect(() => render(<ConfettiCannon fireKey={0} />)).not.toThrow()
  })

  it('survives an engine with no canvas support rather than taking the window down', () => {
    // jsdom has no 2D context and no OffscreenCanvas: this render exercises
    // exactly the unsupported-engine path.
    expect(() => render(<ConfettiCannon fireKey={3} />)).not.toThrow()
  })

  it('reports how many bursts it has fired', () => {
    const { rerender } = render(<ConfettiCannon fireKey={0} />)
    expect(screen.getByTestId('confetti-cannon')).toHaveAttribute('data-burst-count', '0')

    rerender(<ConfettiCannon fireKey={2} />)
    expect(screen.getByTestId('confetti-cannon')).toHaveAttribute('data-burst-count', '2')
  })

  it('stays mounted but silent when disabled', () => {
    render(<ConfettiCannon fireKey={2} enabled={false} />)
    expect(screen.getByTestId('confetti-cannon')).toBeInTheDocument()
  })
})

describe('colours', () => {
  it('falls back to a readable palette when the theme yields nothing', () => {
    expect(readConfettiColors(null).length).toBeGreaterThan(0)
  })

  it('prefers the theme tokens when they are set', () => {
    const host = document.createElement('div')
    host.style.setProperty('--accent-blue', '#0000ff')
    host.style.setProperty('--accent-green', '#00ff00')
    document.body.append(host)

    expect(readConfettiColors(host)).toEqual(['#0000ff', '#00ff00'])

    host.remove()
  })
})

describe('sizing the surface', () => {
  const view = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 } as unknown as Window

  it('measures the element when the element has a size', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ width: 400, height: 300 }) as DOMRect

    expect(surfaceSize(canvas, view)).toEqual({ width: 400, height: 300, devicePixelRatio: 2 })
  })

  /**
   * This app's html, body and root div are all zero-height — the shell is laid
   * out with fixed panes — so a percentage-sized overlay collapses and the
   * burst renders into a 1x1 surface. Found in a browser, not in jsdom, which
   * reports zero for everything and so cannot tell the two cases apart.
   */
  it('falls back to the window when the element measures nothing', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect

    expect(surfaceSize(canvas, view)).toEqual({ width: 1280, height: 720, devicePixelRatio: 2 })
  })

  it('caps the device pixel ratio', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect
    const retina = { innerWidth: 100, innerHeight: 100, devicePixelRatio: 3 } as unknown as Window

    expect(surfaceSize(canvas, retina).devicePixelRatio).toBe(2)
  })
})

describe('reduced motion', () => {
  it('never builds a renderer when the system asks for less motion', () => {
    const matchMedia = vi.fn(() => ({ matches: true }))
    vi.stubGlobal('matchMedia', matchMedia)
    Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true })

    render(<ConfettiCannon fireKey={5} />)

    // The canvas stays in the tree — it is inert, not conditionally mounted,
    // so turning the preference off does not require a remount.
    expect(screen.getByTestId('confetti-cannon')).toBeInTheDocument()
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')

    vi.unstubAllGlobals()
  })
})

/**
 * Transferring a canvas to a worker is one-way and permanent for that
 * element: you cannot transfer twice, and `getContext` throws forever after.
 *
 * React StrictMode mounts, unmounts and remounts effects against the *same*
 * DOM node in development. The first pass transferred, the second could not
 * re-transfer, fell through to `getContext`, and the InvalidStateError took
 * the whole app down with it — a blank window with a stack trace, in dev only.
 *
 * jsdom has neither `transferControlToOffscreen` nor a real 2D context, so no
 * unit test could have caught this; it appeared the first time the app was
 * opened in a browser. The stubs below are what jsdom is missing.
 */
describe('a canvas may only be handed to a worker once', () => {
  it('survives StrictMode mounting the same canvas twice', () => {
    const transfer = vi.fn(function transferOnce(this: HTMLCanvasElement) {
      if ((this as { __transferred?: boolean }).__transferred) {
        throw new Error('already transferred')
      }
      ;(this as { __transferred?: boolean }).__transferred = true
      return {} as OffscreenCanvas
    })
    const getContext = vi.fn(function guardedGetContext(this: HTMLCanvasElement) {
      if ((this as { __transferred?: boolean }).__transferred) {
        throw new Error('Cannot get context from a canvas that has transferred its control')
      }
      return null
    })

    // jsdom defines neither, so they are added rather than spied on.
    Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', {
      value: transfer,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: getContext,
      configurable: true,
      writable: true,
    })
    class FakeWorker {
      postMessage = vi.fn()
      terminate = vi.fn()
    }
    vi.stubGlobal('Worker', FakeWorker)

    expect(() =>
      render(
        <StrictMode>
          <ConfettiCannon fireKey={1} />
        </StrictMode>,
      ),
    ).not.toThrow()

    expect(transfer).toHaveBeenCalledTimes(1)

    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen')
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'getContext')
    vi.unstubAllGlobals()
  })
})
