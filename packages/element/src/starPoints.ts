import { pointFrom, type LocalPoint } from "@excalidraw/math";

/**
 * Inner-to-outer radius ratio for a regular pentagram (5-point star):
 * cos(72deg) / cos(36deg), approximately 0.381966
 */
export const STAR_5_INNER_RADIUS_RATIO =
  Math.cos((72 * Math.PI) / 180) / Math.cos((36 * Math.PI) / 180);

/**
 * 10 vertices (outer/inner alternating) in element-local coordinates,
 * relative to `element.x` / `element.y`, before rotation.
 * Uses the same ellipse-style parameterization as other primitives:
 * x = cx + (width/2) * cos(θ), y = cy + (height/2) * sin(θ).
 */
export const getStar5PointsLocal = (
  width: number,
  height: number,
  radialScale: number = 1,
): LocalPoint[] => {
  const cx = width / 2;
  const cy = height / 2;
  const hx = width / 2;
  const hy = height / 2;
  const points: LocalPoint[] = [];

  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    points.push(
      pointFrom<LocalPoint>(
        cx + radialScale * hx * Math.cos(outerAngle),
        cy + radialScale * hy * Math.sin(outerAngle),
      ),
    );
    points.push(
      pointFrom<LocalPoint>(
        cx +
          radialScale *
            hx *
            STAR_5_INNER_RADIUS_RATIO *
            Math.cos(innerAngle),
        cy +
          radialScale *
            hy *
            STAR_5_INNER_RADIUS_RATIO *
            Math.sin(innerAngle),
      ),
    );
  }

  return points;
};
