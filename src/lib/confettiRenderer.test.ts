import { describe, expect, it, vi } from 'vitest'
import { createConfettiRenderer, drawParticle, type ConfettiContext } from './confettiRenderer'
import { CONFETTI_MAX_PARTICLES, spawnBurst } from './confetti'

function fakeContext(): ConfettiContext & { fills: number; cleared: number } {
  return {
    canvas: { width: 0, height: 0 },
    fillStyle: '',
    globalAlpha: 1,
    fills: 0,
    cleared: 0,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill(this: { fills: number }) {
      this.fills += 1
    },
    clearRect(this: { cleared: number }) {
      this.cleared += 1
    },
    setTransform: vi.fn(),
  }
}

/** A scheduler the test drives by hand, so no real time passes. */
function manualScheduler() {
  let next = 1
  const pending = new Map<number, (timestampMs: number) => void>()
  return {
    scheduler: {
      requestFrame(callback: (timestampMs: number) => void) {
        const handle = next
        next += 1
        pending.set(handle, callback)
        return handle
      },
      cancelFrame(handle: number) {
        pending.delete(handle)
      },
    },
    pendingCount: () => pending.size,
    /** Run every queued frame once, at `timestampMs`. */
    tick(timestampMs: number) {
      const callbacks = [...pending.values()]
      pending.clear()
      for (const callback of callbacks) callback(timestampMs)
    },
  }
}

const SIZE = { width: 800, height: 600, devicePixelRatio: 2 }

describe('the confetti loop', () => {
  it('does nothing at all until something bursts', () => {
    const { scheduler, pendingCount } = manualScheduler()
    const renderer = createConfettiRenderer(fakeContext(), scheduler)
    renderer.resize(SIZE)

    expect(pendingCount()).toBe(0)
    expect(renderer.particleCount()).toBe(0)
  })

  it('draws every live particle each frame', () => {
    const { scheduler, tick } = manualScheduler()
    const context = fakeContext()
    const renderer = createConfettiRenderer(context, scheduler)
    renderer.resize(SIZE)

    renderer.burst(['#fff'])
    tick(0)
    tick(16)

    expect(context.cleared).toBeGreaterThan(0)
    expect(context.fills).toBeGreaterThan(0)
  })

  /**
   * The loop must stop by itself. A permanently scheduled animation frame on
   * an idle window is a battery bug, and this canvas is always mounted.
   */
  it('stops scheduling once the last particle is gone', () => {
    const { scheduler, tick, pendingCount } = manualScheduler()
    const renderer = createConfettiRenderer(fakeContext(), scheduler)
    renderer.resize(SIZE)
    renderer.burst(['#fff'])

    // Well past the longest lifetime, in clamped steps.
    for (let elapsed = 0; elapsed < 20_000 && pendingCount() > 0; elapsed += 33) {
      tick(elapsed)
    }

    expect(renderer.particleCount()).toBe(0)
    expect(pendingCount()).toBe(0)
  })

  it('honours the particle cap when bursts pile up', () => {
    const { scheduler } = manualScheduler()
    const renderer = createConfettiRenderer(fakeContext(), scheduler)
    renderer.resize(SIZE)

    for (let i = 0; i < 10; i += 1) renderer.burst(['#fff'])

    expect(renderer.particleCount()).toBeLessThanOrEqual(CONFETTI_MAX_PARTICLES)
  })

  it('scales the backing store by device pixel ratio, not the layout size', () => {
    const { scheduler } = manualScheduler()
    const context = fakeContext()
    const renderer = createConfettiRenderer(context, scheduler)

    renderer.resize(SIZE)

    expect(context.canvas.width).toBe(1600)
    expect(context.canvas.height).toBe(1200)
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
  })

  it('carries falling particles across a resize instead of stranding them', () => {
    const { scheduler } = manualScheduler()
    const renderer = createConfettiRenderer(fakeContext(), scheduler)
    renderer.resize(SIZE)
    renderer.burst(['#fff'])

    renderer.resize({ width: 400, height: 600, devicePixelRatio: 1 })

    expect(renderer.particleCount()).toBeGreaterThan(0)
  })

  it('drops everything and unschedules on dispose', () => {
    const { scheduler, pendingCount } = manualScheduler()
    const renderer = createConfettiRenderer(fakeContext(), scheduler)
    renderer.resize(SIZE)
    renderer.burst(['#fff'])

    renderer.dispose()

    expect(renderer.particleCount()).toBe(0)
    expect(pendingCount()).toBe(0)
  })
})

describe('drawing one particle', () => {
  it('skips a particle that has not launched yet', () => {
    const context = fakeContext()
    const particle = { ...spawnBurst({ viewport: SIZE, colors: ['#fff'] })[0], ageSeconds: -0.05 }

    drawParticle(context, particle)

    expect(context.fills).toBe(0)
  })

  it('paints in the particle’s own colour', () => {
    const context = fakeContext()
    const particle = { ...spawnBurst({ viewport: SIZE, colors: ['#abcdef'] })[0], ageSeconds: 1 }

    drawParticle(context, particle)

    expect(context.fillStyle).toBe('#abcdef')
    expect(context.fills).toBe(1)
  })
})
