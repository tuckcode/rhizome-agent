export interface CameraPosition {
  x: number
  y: number
  z: number
}

/**
 * Closest the camera may sit to the graph's centre.
 *
 * Chosen so a lone node reads as a node rather than a wall of colour, while
 * still filling enough of the canvas to look deliberate. Tuned against the
 * default node size (`nodeVal` starts at 1) in `ForceGraph3DCanvas`.
 */
export const MIN_CAMERA_DISTANCE = 180

/**
 * Pull an over-tight camera back to `MIN_CAMERA_DISTANCE`, keeping its heading.
 *
 * `zoomToFit` frames the graph's bounding box, but a single node is a zero-size
 * box — so it flies the camera arbitrarily close and one note fills the canvas
 * (C63). Returns `null` when the framing is already comfortable, so the caller
 * can skip moving a camera that is fine where it is.
 */
export function clampedCameraPosition(
  position: CameraPosition,
  minimum: number = MIN_CAMERA_DISTANCE,
): CameraPosition | null {
  const distance = Math.hypot(position.x, position.y, position.z)
  if (Number.isFinite(distance) && distance >= minimum) return null
  // A lone node sits at the origin, so the framed camera can land there too.
  // Scaling a zero-length (or non-finite) vector yields NaN and loses the
  // scene, so pull straight back along z instead.
  if (!Number.isFinite(distance) || distance === 0) return { x: 0, y: 0, z: minimum }
  const scale = minimum / distance
  return { x: position.x * scale, y: position.y * scale, z: position.z * scale }
}
