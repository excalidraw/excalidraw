/**
 * Computes the two endpoints of a gradient line through the center of a
 * `width` x `height` box, in the box's local coordinate space (0..width,
 * 0..height), for a given angle in degrees.
 *
 * Angle convention: 0 = left-to-right, increasing clockwise (matches how
 * the angle slider in the UI is labeled).
 */
export const getGradientLineCoords = (
  width: number,
  height: number,
  angleDegrees: number,
): { x1: number; y1: number; x2: number; y2: number } => {
  const cx = width / 2;
  const cy = height / 2;
  const radians = (angleDegrees * Math.PI) / 180;

  // Compute the distance to extend from the center such that the line
  // hits the box edge (envelope of the rectangle in the given direction)
  const cosAbs = Math.abs(Math.cos(radians));
  const sinAbs = Math.abs(Math.sin(radians));
  const ratio = Math.max(cosAbs / cx, sinAbs / cy);
  const halfLength = ratio > 0 ? 1 / ratio : Math.sqrt(cx * cx + cy * cy);

  const dx = Math.cos(radians) * halfLength;
  const dy = Math.sin(radians) * halfLength;

  return {
    x1: cx - dx,
    y1: cy - dy,
    x2: cx + dx,
    y2: cy + dy,
  };
};
