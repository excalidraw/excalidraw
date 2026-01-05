import {
  pointFrom,
  pointDistance,
  type LocalPoint,
  vectorFromPoint,
  vectorNormalize,
} from "@excalidraw/math";

import polygonClipping from "polygon-clipping";

import type { Polygon, MultiPolygon, Ring } from "polygon-clipping";

import type { ExcalidrawFreeDrawElement } from "./types";

// Number of segments to approximate each semicircular cap
const CAP_SEGMENTS = 8;

// Minimum radius to avoid degenerate shapes
const MIN_RADIUS = 0.5;

// Pressure to radius multiplier (scaled by strokeWidth)
const PRESSURE_RADIUS_MULTIPLIER = 2.0;

/**
 * Compute the radius for a point based on pressure and strokeWidth.
 * Pressure is typically in [0, 1] range, default to 0.5 if simulating.
 */
function getRadiusForPressure(pressure: number, strokeWidth: number): number {
  return Math.max(
    MIN_RADIUS,
    pressure * strokeWidth * PRESSURE_RADIUS_MULTIPLIER,
  );
}

/**
 * Generate points along a semicircular arc (dome/cap).
 * The arc goes from startAngle to endAngle (counterclockwise).
 *
 * @param center - Center point of the arc
 * @param radius - Radius of the arc
 * @param startAngle - Start angle in radians
 * @param endAngle - End angle in radians (counterclockwise from start)
 * @param segments - Number of segments to divide the arc into
 * @returns Array of points along the arc
 */
function generateArcPoints(
  center: LocalPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): LocalPoint[] {
  const points: LocalPoint[] = [];
  const angleStep = (endAngle - startAngle) / segments;

  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + i * angleStep;
    points.push(
      pointFrom<LocalPoint>(
        center[0] + radius * Math.cos(angle),
        center[1] + radius * Math.sin(angle),
      ),
    );
  }

  return points;
}

/**
 * Create an ovoid shape between two consecutive points.
 * The ovoid consists of:
 * - A semicircular cap at the first point (facing away from point 2)
 * - A semicircular cap at the second point (facing away from point 1)
 * - Connecting lines (tangent lines between the two circles)
 *
 * @param p1 - First point
 * @param r1 - Radius at first point (from pressure)
 * @param p2 - Second point
 * @param r2 - Radius at second point (from pressure)
 * @returns Array of points forming the ovoid polygon
 */
function createOvoid(
  p1: LocalPoint,
  r1: number,
  p2: LocalPoint,
  r2: number,
): LocalPoint[] {
  const dist = pointDistance(p1, p2);

  // If points are too close, create a circle at the midpoint
  if (dist < 0.001) {
    const avgRadius = (r1 + r2) / 2;
    return generateArcPoints(p1, avgRadius, 0, Math.PI * 2, CAP_SEGMENTS * 2);
  }

  // Direction vector from p1 to p2
  const dirVec = vectorFromPoint(p2, p1);
  const normalizedDir = vectorNormalize(dirVec);

  // Calculate the angle of the direction vector
  const baseAngle = Math.atan2(normalizedDir[1], normalizedDir[0]);

  // For connecting the circles with tangent lines when radii differ,
  // we need to compute the tangent points
  // When r1 != r2, the tangent lines are not perpendicular to the center line

  // Tangent angle offset (when radii differ)
  const radiusDiff = r1 - r2;
  const tangentAngleOffset =
    dist > Math.abs(radiusDiff) ? Math.asin(radiusDiff / dist) : 0;

  // Compute tangent points on each circle
  // The perpendicular offset needs to be adjusted for the tangent angle
  const tangentPerpAngle = baseAngle + Math.PI / 2 + tangentAngleOffset;

  // Cap at p1 (semicircle facing away from p2)
  // Goes from p1Right to p1Left (counterclockwise, facing back)
  const cap1StartAngle = tangentPerpAngle + Math.PI;
  const cap1EndAngle = cap1StartAngle + Math.PI;
  const cap1Points = generateArcPoints(
    p1,
    r1,
    cap1StartAngle,
    cap1EndAngle,
    CAP_SEGMENTS,
  );

  // Cap at p2 (semicircle facing away from p1)
  // Goes from p2Left to p2Right (counterclockwise, facing forward)
  const cap2StartAngle = tangentPerpAngle;
  const cap2EndAngle = cap2StartAngle + Math.PI;
  const cap2Points = generateArcPoints(
    p2,
    r2,
    cap2StartAngle,
    cap2EndAngle,
    CAP_SEGMENTS,
  );

  // Assemble the ovoid polygon:
  // cap1 goes around the back of p1, cap2 goes around the front of p2
  // The arc endpoints naturally connect with the tangent lines
  const ovoidPoints: LocalPoint[] = [
    ...cap1Points, // p1's back cap
    ...cap2Points, // p2's front cap
  ];

  return ovoidPoints;
}

/**
 * Convert a polygon (array of LocalPoints) to polygon-clipping format.
 * polygon-clipping expects: [[[x,y], [x,y], ...]]
 */
function toClipperPolygon(points: LocalPoint[]): Polygon {
  if (points.length === 0) {
    return [];
  }
  // Ensure the polygon is closed
  const ring: Ring = points.map((p) => [p[0], p[1]]);

  // Close the ring if not already closed
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push([ring[0][0], ring[0][1]]);
  }

  return [ring];
}

/**
 * Convert polygon-clipping result back to LocalPoint arrays.
 * Returns the largest polygon (by point count) from the result.
 */
function fromClipperResult(result: MultiPolygon): LocalPoint[][] {
  return result.map((polygon) =>
    polygon[0].map((coord) => pointFrom<LocalPoint>(coord[0], coord[1])),
  );
}

/**
 * Generate the outline of a freedraw element using the ovoid-union approach.
 *
 * This creates ovoid shapes between each consecutive pair of points,
 * where each ovoid is defined by:
 * - Semicircular caps at each point (radius based on pressure)
 * - Connecting tangent lines between the caps
 *
 * All ovoids are then unioned together to form the final outline.
 *
 * @param element - The freedraw element to generate outline for
 * @returns Array of [x, y] points representing the outline polygon
 */
export function generateFreeDrawOvoidOutline(
  element: ExcalidrawFreeDrawElement,
): [number, number][] {
  const { points, pressures, simulatePressure, strokeWidth } = element;

  if (points.length === 0) {
    return [];
  }

  // Single point: just return a circle
  if (points.length === 1) {
    const pressure = simulatePressure ? 0.5 : pressures[0] ?? 0.5;
    const radius = getRadiusForPressure(pressure, strokeWidth);
    const circlePoints = generateArcPoints(
      points[0] as LocalPoint,
      radius,
      0,
      Math.PI * 2,
      CAP_SEGMENTS * 2,
    );
    return circlePoints.map((p) => [p[0], p[1]]);
  }

  // Generate ovoids for each consecutive pair of points
  const ovoids: Polygon[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i] as LocalPoint;
    const p2 = points[i + 1] as LocalPoint;

    // Get pressures (use 0.5 as default when simulating)
    const pressure1 = simulatePressure ? 0.5 : pressures[i] ?? 0.5;
    const pressure2 = simulatePressure ? 0.5 : pressures[i + 1] ?? 0.5;

    const r1 = getRadiusForPressure(pressure1, strokeWidth);
    const r2 = getRadiusForPressure(pressure2, strokeWidth);

    const ovoidPoints = createOvoid(p1, r1, p2, r2);

    if (ovoidPoints.length >= 3) {
      ovoids.push(toClipperPolygon(ovoidPoints));
    }
  }

  if (ovoids.length === 0) {
    return [];
  }

  // Union all ovoids together
  const result = polygonClipping.union(
    [ovoids[0]],
    ...ovoids.slice(1).map((ovoid) => [ovoid]),
  );

  // let result: MultiPolygon = ovoids[0] ? [ovoids[0]] : [];

  // for (let i = 1; i < ovoids.length; i++) {
  //   if (ovoids[i]) {
  //     try {
  //       result = polygonClipping.union(result, [ovoids[i]]);
  //     } catch {
  //       // If union fails for this ovoid, skip it
  //       continue;
  //     }
  //   }
  // }

  if (result.length === 0) {
    return [];
  }

  // Convert back to point array
  // Take the outer ring of the first (largest) polygon
  const outlinePolygons = fromClipperResult(result);

  if (outlinePolygons.length === 0 || outlinePolygons[0].length === 0) {
    return [];
  }

  // Return the first (outer) polygon
  return outlinePolygons[0].map((p) => [p[0], p[1]]);
}

/**
 * Convert the ovoid outline to an SVG path string. Uses quadratic curves
 * for smoothing.
 */
export function generateFreeDrawOvoidSvgPath(
  element: ExcalidrawFreeDrawElement,
): string {
  const points = generateFreeDrawOvoidOutline(element);

  if (points.length === 0) {
    console.warn("No outline points generated for freedraw element");
    return "";
  }

  if (points.length < 3) {
    console.warn("Not enough outline points to form a closed path");
    return "";
  }

  // Use a similar approach to the original getSvgPathFromStroke
  // but with the ovoid-generated points
  const med = (a: number[], b: number[]) => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  const pathData = points
    // Build a closed, smoothed SVG path from the outline polygon
    .reduce(
      (acc: (string | number[])[], point, i, arr) => {
        if (i === points.length - 1) {
          // For the last point, add a line-to ("L") back to the first point and close
          // ("Z").
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          // Use a single quadratic command ("Q") and then emit point + midpoint pairs
          // so each segment curves through the current point toward the midpoint of
          // the next segment.
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      // Start with a move-to ("M") to the first point.
      ["M", points[0], "Q"],
    )
    .join(" ")
    // Trim excessive float precision to keep the path string compact/stable.
    .replace(/(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g, "$1");

  return pathData;
}
