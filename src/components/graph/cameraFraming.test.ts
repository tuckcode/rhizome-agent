import { describe, expect, it } from 'vitest'
import { MIN_CAMERA_DISTANCE, clampedCameraPosition } from './cameraFraming'

describe('clampedCameraPosition', () => {
  // C63: zoomToFit frames the graph's bounding box, and a single node is a
  // zero-size box — so the camera flies arbitrarily close and one note fills
  // the canvas as a ~500px dot.
  it('pushes the camera back when a sparse graph framed it too close', () => {
    const clamped = clampedCameraPosition({ x: 0, y: 0, z: 12 })

    expect(clamped).not.toBeNull()
    expect(distanceOf(clamped!)).toBeCloseTo(MIN_CAMERA_DISTANCE, 5)
  })

  it('keeps the framing direction while pushing it back', () => {
    const clamped = clampedCameraPosition({ x: 3, y: 4, z: 0 })

    expect(clamped).not.toBeNull()
    // Same heading (3,4,0 normalizes to 0.6,0.8,0), just further out.
    expect(clamped!.x).toBeCloseTo(0.6 * MIN_CAMERA_DISTANCE, 5)
    expect(clamped!.y).toBeCloseTo(0.8 * MIN_CAMERA_DISTANCE, 5)
    expect(clamped!.z).toBeCloseTo(0, 5)
  })

  it('leaves a comfortably framed graph alone', () => {
    expect(clampedCameraPosition({ x: 0, y: 0, z: MIN_CAMERA_DISTANCE + 50 })).toBeNull()
  })

  it('does not nudge a camera that is already exactly at the floor', () => {
    expect(clampedCameraPosition({ x: 0, y: 0, z: MIN_CAMERA_DISTANCE })).toBeNull()
  })

  /**
   * A single node sits at the origin, so the framed camera can land there too.
   * Scaling a zero-length vector is undefined, so fall back to a straight pull
   * back rather than emitting NaN and losing the scene entirely.
   */
  it('falls back to a straight pull back when the camera sits on the origin', () => {
    expect(clampedCameraPosition({ x: 0, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: MIN_CAMERA_DISTANCE,
    })
  })

  it('treats a non-finite camera position as needing the fallback', () => {
    expect(clampedCameraPosition({ x: Number.NaN, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: MIN_CAMERA_DISTANCE,
    })
  })
})

function distanceOf(position: { x: number; y: number; z: number }): number {
  return Math.hypot(position.x, position.y, position.z)
}
