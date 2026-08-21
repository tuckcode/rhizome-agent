/**
 * Confetti physics. No canvas, no DOM, no worker — just numbers, so the part
 * that decides how a burst behaves can be tested without rendering anything.
 *
 * The model is a cannon at the bottom of the window firing upward: particles
 * launch fast, gravity wins, and they flutter down turning over as they slow.
 * Each one is a thin skewed card whose vertical scale oscillates, which reads
 * as a piece of paper flipping edge-on without any 3D maths.
 *
 * Numbers are in the spirit of Cursor's effects worker, which this was
 * measured against before being written: a bottom-centre cannon, ~180
 * particles, gravity around 500 px/s², flutter that grows as a particle
 * slows, and a long fluttering fall rather than a quick pop. What is not
 * borrowed is the palette — ours comes from the theme, so the burst belongs
 * to whichever mode the app is in.
 */

/** Particles per burst. */
export const CONFETTI_BURST_SIZE = 180

/**
 * Hard ceiling across every live burst. Two celebrations landing together
 * should look like one big one, not like a dropped frame rate.
 */
export const CONFETTI_MAX_PARTICLES = 400

/** Downward acceleration, px/s². */
export const CONFETTI_GRAVITY = 500

/**
 * Longest frame the simulation will integrate.
 *
 * A backgrounded window hands back a delta measured in seconds. Integrated
 * raw, every particle jumps off-screen at once and the burst is simply gone
 * when the user looks back — so a slow frame becomes a short one instead.
 */
export const MAX_FRAME_SECONDS = 1 / 30

export interface ConfettiViewport {
  width: number
  height: number
}

export interface ConfettiParticle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  /** Negative while the particle is still waiting its turn to launch. */
  ageSeconds: number
  lifetimeSeconds: number
  width: number
  height: number
  mass: number
  rotation: number
  angularVelocity: number
  angularDrag: number
  /** Drives the edge-on flip; see `flipScale`. */
  flipPhase: number
  flipSpeed: number
  horizontalDrag: number
  windSpeed: number
  flutterAcceleration: number
  flutterFrequency: number
  flutterPhase: number
  flutterTorque: number
  torqueFrequency: number
  terminalFallSpeed: number
  ascentDrag: number
  /** How far the card's corners lean, so it is not a plain rectangle. */
  cornerSkew: number
  color: string
}

export interface SpawnOptions {
  viewport: ConfettiViewport
  colors: readonly string[]
  /** Injected for tests; defaults to `Math.random`. */
  random?: () => number
  /** How many particles may still be added before the cap. */
  room?: number
  count?: number
}

function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min)
}

/**
 * Roughly triangular, in -1..1 and biased to the middle.
 *
 * Used for the launch angle: a flat random spread fires as many particles
 * sideways as upward, which looks like a leak rather than a cannon.
 */
function centred(random: () => number): number {
  return (random() + random() + random() - 1.5) / 1.5
}

export function spawnBurst({
  viewport,
  colors,
  random = Math.random,
  room = CONFETTI_MAX_PARTICLES,
  count = CONFETTI_BURST_SIZE,
}: SpawnOptions): ConfettiParticle[] {
  const wanted = Math.min(count, Math.max(0, room))
  if (wanted === 0 || colors.length === 0) return []

  return Array.from({ length: wanted }, (_unused, index) => {
    const mass = between(random, 0.72, 1.34)
    const lightness = random()
    const speed = between(random, 1350, 1550) / mass ** 0.35
    const angle = centred(random) * (Math.PI / 12)
    const width = between(random, 5, 11)

    return {
      // Below the bottom edge: the cannon itself is never on screen, only
      // what comes out of it.
      x: viewport.width / 2 + between(random, -10, 10),
      y: viewport.height + between(random, 5, 14),
      velocityX: Math.sin(angle) * speed + between(random, -35, 35),
      velocityY: -Math.cos(angle) * speed,
      ageSeconds: -between(random, 0, 0.12),
      lifetimeSeconds: between(random, 9, 13),
      width,
      height: width * between(random, 0.45, 1.15),
      mass,
      rotation: between(random, 0, Math.PI * 2),
      angularVelocity: between(random, -20, 20),
      angularDrag: between(random, 0.25, 0.7),
      flipPhase: between(random, 0, Math.PI * 2),
      flipSpeed: between(random, 10, 24),
      horizontalDrag: between(random, 0.6, 1.3),
      windSpeed: between(random, -24, 24),
      flutterAcceleration: (between(random, 95, 190) * (0.8 + lightness)) / mass,
      flutterFrequency: between(random, 5, 11),
      flutterPhase: between(random, 0, Math.PI * 2),
      flutterTorque: between(random, 25, 60),
      torqueFrequency: between(random, 4, 9),
      terminalFallSpeed: 38 + mass * 22 + (1 - lightness) * 20,
      ascentDrag: 0.95 + lightness * 0.58,
      cornerSkew: between(random, -0.22, 0.22),
      // Dealt in order rather than picked at random: a random pick clumps
      // visibly at this count and can drop a colour from the burst entirely.
      color: colors[index % colors.length],
    }
  })
}

/**
 * Move one particle forward. Returns false when it should be retired.
 *
 * Mutates rather than returning a copy: this runs 400 times a frame at 60fps,
 * and allocating a fresh object each time is the difference between a smooth
 * burst and a stuttering one on a laptop that is already compiling something.
 */
export function advanceParticle(
  particle: ConfettiParticle,
  deltaSeconds: number,
  viewport: ConfettiViewport,
): boolean {
  const delta = Math.min(MAX_FRAME_SECONDS, Math.max(0, deltaSeconds))
  particle.ageSeconds += delta
  if (particle.ageSeconds < 0) return true

  // Rising and falling are damped differently: on the way up the particle is
  // fighting its own launch, on the way down it settles to a terminal speed
  // set by its mass. One drag for both makes everything fall like a stone.
  const drag =
    particle.velocityY < 0
      ? Math.max(0.82, Math.min(1.65, particle.ascentDrag / particle.mass))
      : CONFETTI_GRAVITY / particle.terminalFallSpeed

  // Flutter grows as the particle slows: a fast card holds its line, a
  // drifting one wobbles. This is what makes it read as paper.
  const slowness = Math.max(0, 1 - Math.abs(particle.velocityY) / 700)
  const flutter =
    Math.sin(particle.ageSeconds * particle.flutterFrequency + particle.flutterPhase) *
    particle.flutterAcceleration *
    slowness

  particle.velocityX +=
    (flutter - particle.horizontalDrag * (particle.velocityX - particle.windSpeed)) * delta
  particle.velocityY += (CONFETTI_GRAVITY - drag * particle.velocityY) * delta
  particle.x += particle.velocityX * delta
  particle.y += particle.velocityY * delta

  const torque =
    Math.sin(particle.ageSeconds * particle.torqueFrequency + particle.flutterPhase) *
    particle.flutterTorque *
    (0.35 + slowness * 0.65)
  particle.angularVelocity += (torque - particle.angularDrag * particle.angularVelocity) * delta
  particle.rotation += particle.angularVelocity * delta
  particle.flipPhase += particle.flipSpeed * delta

  const driftedOff =
    particle.x < -particle.width * 2 || particle.x > viewport.width + particle.width * 2
  const landed = particle.velocityY > 0 && particle.y > viewport.height + particle.height * 2
  return particle.ageSeconds < particle.lifetimeSeconds && !driftedOff && !landed
}

/** Seconds of fade at the end of a particle's life. */
export const CONFETTI_FADE_SECONDS = 1.5

/** How opaque a particle is right now. */
export function particleOpacity(particle: ConfettiParticle): number {
  const fadeFrom = particle.lifetimeSeconds - CONFETTI_FADE_SECONDS
  if (particle.ageSeconds <= fadeFrom) return 1
  return Math.max(0, (particle.lifetimeSeconds - particle.ageSeconds) / CONFETTI_FADE_SECONDS)
}

/**
 * Vertical squash standing in for a card turning edge-on.
 *
 * Never reaches zero — a card that vanishes completely at the turn reads as a
 * flicker rather than a flip.
 */
export function flipScale(particle: ConfettiParticle): number {
  return 0.16 + Math.abs(Math.cos(particle.flipPhase)) * 0.84
}
