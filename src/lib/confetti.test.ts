import { describe, expect, it } from 'vitest'
import {
  CONFETTI_BURST_SIZE,
  CONFETTI_MAX_PARTICLES,
  MAX_FRAME_SECONDS,
  advanceParticle,
  spawnBurst,
  type ConfettiParticle,
} from './confetti'

const VIEWPORT = { width: 1000, height: 600 }
const COLORS = ['#111111', '#222222', '#333333']

/** Deterministic stand-in for Math.random so physics is testable at all. */
function sequence(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

describe('spawning a burst', () => {
  it('fires from just below the bottom centre, so the cannon is off-screen', () => {
    const particles = spawnBurst({ viewport: VIEWPORT, colors: COLORS, random: sequence([0.5]) })

    for (const particle of particles) {
      expect(Math.abs(particle.x - VIEWPORT.width / 2)).toBeLessThan(40)
      expect(particle.y).toBeGreaterThan(VIEWPORT.height)
    }
  })

  it('launches everything upward', () => {
    const particles = spawnBurst({ viewport: VIEWPORT, colors: COLORS })
    expect(particles).toHaveLength(CONFETTI_BURST_SIZE)
    for (const particle of particles) {
      expect(particle.velocityY).toBeLessThan(0)
    }
  })

  /**
   * Round-robin rather than random: a random pick leaves visible colour
   * clumps in a 180-particle burst, and one colour can go missing entirely.
   */
  it('deals colours round-robin so every burst is evenly coloured', () => {
    const particles = spawnBurst({ viewport: VIEWPORT, colors: COLORS })
    const counts = new Map<string, number>()
    for (const particle of particles) {
      counts.set(particle.color, (counts.get(particle.color) ?? 0) + 1)
    }
    expect(counts.size).toBe(COLORS.length)
    const tallies = [...counts.values()]
    expect(Math.max(...tallies) - Math.min(...tallies)).toBeLessThanOrEqual(1)
  })

  it('staggers the start so the burst does not leave as one wall', () => {
    const particles = spawnBurst({ viewport: VIEWPORT, colors: COLORS })
    const ages = new Set(particles.map((particle) => particle.ageSeconds))
    expect(ages.size).toBeGreaterThan(1)
    for (const particle of particles) {
      expect(particle.ageSeconds).toBeLessThanOrEqual(0)
    }
  })

  it('refuses to exceed the particle cap when bursts overlap', () => {
    const existing = spawnBurst({ viewport: VIEWPORT, colors: COLORS })
    const room = CONFETTI_MAX_PARTICLES - existing.length
    const next = spawnBurst({ viewport: VIEWPORT, colors: COLORS, room })
    expect(existing.length + next.length).toBeLessThanOrEqual(CONFETTI_MAX_PARTICLES)

    expect(spawnBurst({ viewport: VIEWPORT, colors: COLORS, room: 0 })).toHaveLength(0)
  })
})

describe('advancing a particle', () => {
  function particle(overrides: Partial<ConfettiParticle> = {}): ConfettiParticle {
    return { ...spawnBurst({ viewport: VIEWPORT, colors: COLORS })[0], ...overrides }
  }

  it('holds a not-yet-launched particle still until its delay elapses', () => {
    const waiting = particle({ ageSeconds: -0.1, x: 500, y: 620 })
    const before = { x: waiting.x, y: waiting.y }

    expect(advanceParticle(waiting, 0.05, VIEWPORT)).toBe(true)
    expect(waiting.x).toBe(before.x)
    expect(waiting.y).toBe(before.y)
  })

  it('pulls a rising particle back down', () => {
    const rising = particle({ ageSeconds: 0, velocityY: -400 })
    advanceParticle(rising, 0.1, VIEWPORT)
    expect(rising.velocityY).toBeGreaterThan(-400)
  })

  it('retires a particle once its life is spent', () => {
    const spent = particle({ ageSeconds: 100, lifetimeSeconds: 10 })
    expect(advanceParticle(spent, 0.016, VIEWPORT)).toBe(false)
  })

  it('retires a particle that has fallen well past the bottom', () => {
    const fallen = particle({ ageSeconds: 1, velocityY: 200, y: VIEWPORT.height + 500 })
    expect(advanceParticle(fallen, 0.016, VIEWPORT)).toBe(false)
  })

  /**
   * A backgrounded window hands back a delta of seconds, not milliseconds.
   * Integrated raw, every particle teleports off-screen and the burst is gone
   * the moment you look back at it.
   */
  it('clamps a huge frame delta instead of teleporting the burst', () => {
    const steady = particle({ ageSeconds: 0, y: 300, velocityY: -400 })
    const stalled = { ...steady }

    advanceParticle(steady, MAX_FRAME_SECONDS, VIEWPORT)
    advanceParticle(stalled, 30, VIEWPORT)

    expect(stalled.y).toBeCloseTo(steady.y, 5)
  })
})
