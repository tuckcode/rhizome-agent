/**
 * The animation loop, written once and hosted twice.
 *
 * A worker owning an `OffscreenCanvas` is the good case: confetti then cannot
 * stutter because the main thread is busy laying out a note or parsing a
 * vault. Where that is unavailable the same loop runs on the main thread
 * against an ordinary canvas — the difference is where it lives, not what it
 * does, which is why the loop takes its context and its scheduler as
 * arguments rather than reaching for globals.
 */

import {
  CONFETTI_MAX_PARTICLES,
  advanceParticle,
  flipScale,
  particleOpacity,
  spawnBurst,
  type ConfettiParticle,
  type ConfettiViewport,
} from './confetti'

/** The slice of a 2D context this uses. Both canvas flavours satisfy it. */
export interface ConfettiContext {
  canvas: { width: number; height: number }
  fillStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  save(): void
  restore(): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  scale(x: number, y: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
  clearRect(x: number, y: number, width: number, height: number): void
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void
}

export interface ConfettiSurfaceSize extends ConfettiViewport {
  devicePixelRatio: number
}

export interface ConfettiScheduler {
  requestFrame(callback: (timestampMs: number) => void): number
  cancelFrame(handle: number): void
}

/** Draw one particle as a skewed, flipping card. */
export function drawParticle(context: ConfettiContext, particle: ConfettiParticle): void {
  if (particle.ageSeconds < 0) return

  const halfWidth = particle.width / 2
  const halfHeight = particle.height / 2
  const skew = particle.cornerSkew * particle.width

  context.save()
  context.globalAlpha = particleOpacity(particle)
  context.translate(particle.x, particle.y)
  context.rotate(particle.rotation)
  context.scale(1, flipScale(particle))
  context.fillStyle = particle.color
  context.beginPath()
  context.moveTo(-halfWidth + skew, -halfHeight)
  context.lineTo(halfWidth, -halfHeight + skew * 0.25)
  context.lineTo(halfWidth - skew, halfHeight)
  context.lineTo(-halfWidth, halfHeight - skew * 0.25)
  context.closePath()
  context.fill()
  context.restore()
}

export interface ConfettiRenderer {
  /** Fire a burst in the given colours. Adds to whatever is already falling. */
  burst(colors: readonly string[]): void
  resize(size: ConfettiSurfaceSize): void
  /** Live particle count — the loop stops on its own when this reaches zero. */
  particleCount(): number
  dispose(): void
}

export function createConfettiRenderer(
  context: ConfettiContext,
  scheduler: ConfettiScheduler,
): ConfettiRenderer {
  let particles: ConfettiParticle[] = []
  let viewport: ConfettiViewport = { width: 1, height: 1 }
  let frameHandle: number | undefined
  let lastTimestampMs: number | undefined

  function scheduleFrame() {
    frameHandle = scheduler.requestFrame(renderFrame)
  }

  function renderFrame(timestampMs: number) {
    const deltaSeconds =
      lastTimestampMs === undefined ? 1 / 60 : Math.max(0, (timestampMs - lastTimestampMs) / 1000)
    lastTimestampMs = timestampMs

    context.clearRect(0, 0, viewport.width, viewport.height)

    // Compacted in place rather than filtered into a new array: this runs
    // every frame, and the garbage from 400 discarded arrays a second is the
    // kind of thing that shows up as a stutter in the burst it is animating.
    let kept = 0
    for (const particle of particles) {
      if (!advanceParticle(particle, deltaSeconds, viewport)) continue
      particles[kept] = particle
      kept += 1
      drawParticle(context, particle)
    }
    particles.length = kept

    if (particles.length === 0) {
      frameHandle = undefined
      return
    }
    scheduleFrame()
  }

  return {
    burst(colors) {
      const room = CONFETTI_MAX_PARTICLES - particles.length
      const fresh = spawnBurst({ viewport, colors, room })
      if (fresh.length === 0) return
      particles.push(...fresh)
      if (frameHandle === undefined) {
        lastTimestampMs = undefined
        scheduleFrame()
      }
    },

    resize(size) {
      // Keep whatever is in flight where it looks like it was, proportionally,
      // instead of leaving it stranded off the new canvas.
      const scaleX = viewport.width > 0 ? size.width / viewport.width : 1
      const scaleY = viewport.height > 0 ? size.height / viewport.height : 1
      for (const particle of particles) {
        particle.x *= scaleX
        particle.y *= scaleY
      }

      viewport = { width: Math.max(1, size.width), height: Math.max(1, size.height) }
      const ratio = Math.max(1, size.devicePixelRatio)
      context.canvas.width = Math.round(viewport.width * ratio)
      context.canvas.height = Math.round(viewport.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    },

    particleCount() {
      return particles.length
    },

    dispose() {
      if (frameHandle !== undefined) scheduler.cancelFrame(frameHandle)
      frameHandle = undefined
      particles = []
      context.clearRect(0, 0, viewport.width, viewport.height)
    },
  }
}
