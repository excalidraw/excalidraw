import {
  pointFrom,
  pointDistance,
  type LocalPoint,
  vectorFromPoint,
  vectorNormalize,
  lineSegment,
  type GlobalPoint,
  type Polygon,
  polygonFromPoints,
} from "@excalidraw/math";
import { debugDrawLine, debugDrawPolygon } from "@excalidraw/common";

import type { ExcalidrawFreeDrawElement } from "./types";

// Number of segments to approximate each semicircular cap
const CAP_SEGMENTS = 20;

// Minimum radius to avoid degenerate shapes
const MIN_RADIUS = 0.05;

// Pressure to radius multiplier (scaled by strokeWidth)
const PRESSURE_RADIUS_MULTIPLIER = 2.0;

// Minimum distance between points to avoid numerical instability
const MIN_POINT_DISTANCE = 0.001;

// Epsilon for filtering near-duplicate points in polygons
const EPSILON = 0.01;

// Simple union implementation taking advantage of the following facts:
// - The ovoids are generated in sequence along the stroke path
// - Each ovoid overlaps only with its immediate neighbors
// - The ovoids are convex shapes

// Therefore, we can simply stitch together the outer edges of the ovoids
// by taking the first half of the first ovoid and the second half of the last ovoid,
// and connecting them with the outer edges of the intermediate ovoids. The overlapping
// ovoid caps are always the same radius at the shared points, so they align perfectly.
// It should be easy to find the closest point to the side of the previous side segment and
// one of the closest points on the next ovoid's start cap.
function chainOvoidsIntoSinglePolygon<P extends LocalPoint | GlobalPoint>(
  records: {
    polygon: Polygon<P>;
    firstPoint: P;
    secondPoint: P;
  }[],
): Polygon<P> | null {
  if (records.length === 0) {
    return null;
  }

  if (records.length === 1) {
    return records[0].polygon;
  }

  const capPointCount = CAP_SEGMENTS + 1;

  const isClosedPolygon = (points: P[]) => {
    if (points.length < 2) {
      return false;
    }
    const first = points[0];
    const last = points[points.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  };

  const openPolygon = (points: P[]) =>
    isClosedPolygon(points) ? points.slice(0, -1) : points.slice();

  const distanceSq = (a: P, b: P) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return dx * dx + dy * dy;
  };

  const distanceToSegmentSq = (p: P, a: P, b: P) => {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = p[0] - a[0];
    const apy = p[1] - a[1];
    const abLenSq = abx * abx + aby * aby;

    if (abLenSq === 0) {
      return distanceSq(p, a);
    }

    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    const closest = pointFrom<P>(a[0] + abx * t, a[1] + aby * t);
    return distanceSq(p, closest);
  };

  const closestIndexToSegment = (points: P[], a: P, b: P) => {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < points.length; i++) {
      const dist = distanceToSegmentSq(points[i], a, b);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  const pushIfDistinct = (points: P[], point: P) => {
    if (points.length === 0) {
      points.push(point);
      return;
    }
    if (distanceSq(points[points.length - 1], point) > EPSILON * EPSILON) {
      points.push(point);
    }
  };

  const ovoids = records.map((record) => {
    const open = openPolygon(record.polygon);

    if (open.length < capPointCount * 2) {
      return {
        cap1: open,
        cap2: [] as P[],
        p1Right: open[0],
        p1Left: open[open.length - 1],
        p2Left: open[0],
        p2Right: open[open.length - 1],
      };
    }

    const cap1 = open.slice(0, capPointCount);
    const cap2 = open.slice(capPointCount, capPointCount * 2);

    return {
      cap1,
      cap2,
      p1Right: cap1[0],
      p1Left: cap1[cap1.length - 1],
      p2Left: cap2[0],
      p2Right: cap2[cap2.length - 1],
    };
  });

  const leftChain: P[] = [];
  const rightChain: P[] = [];

  ovoids[0].cap1.forEach((point) => pushIfDistinct(leftChain, point));
  pushIfDistinct(rightChain, ovoids[0].p1Right);

  for (let i = 0; i < ovoids.length; i++) {
    const current = ovoids[i];

    pushIfDistinct(leftChain, current.p2Left);
    pushIfDistinct(rightChain, current.p2Right);

    if (i + 1 >= ovoids.length) {
      continue;
    }

    const next = ovoids[i + 1];

    const leftIndex = closestIndexToSegment(
      next.cap1,
      current.p1Left,
      current.p2Left,
    );

    for (let j = leftIndex; j < next.cap1.length; j++) {
      pushIfDistinct(leftChain, next.cap1[j]);
    }

    const rightIndex = closestIndexToSegment(
      next.cap1,
      current.p1Right,
      current.p2Right,
    );

    for (let j = rightIndex; j >= 0; j--) {
      pushIfDistinct(rightChain, next.cap1[j]);
    }
  }

  const lastOvoid = ovoids[ovoids.length - 1];
  lastOvoid.cap2.forEach((point) => pushIfDistinct(leftChain, point));

  const rightChainReversed = rightChain.slice(0, -1).reverse();
  const outline = filterNearDuplicates<P>([
    ...leftChain,
    ...rightChainReversed,
  ]);

  return polygonFromPoints<P>(outline);
}

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
function generateArcPoints<P extends LocalPoint | GlobalPoint>(
  center: LocalPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): P[] {
  const points: P[] = [];
  const angleStep = (endAngle - startAngle) / segments;

  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + i * angleStep;
    points.push(
      pointFrom<P>(
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
 * @param forcePerpendicularCap1 - Force cap1 to be perpendicular (for stroke start)
 * @param forcePerpendicularCap2 - Force cap2 to be perpendicular (for stroke end)
 * @returns Array of points forming the ovoid polygon
 */
function createOvoid<P extends LocalPoint | GlobalPoint>(
  p1: LocalPoint,
  r1: number,
  p2: LocalPoint,
  r2: number,
  forcePerpendicularCap1: boolean = false,
  forcePerpendicularCap2: boolean = false,
): Polygon<P> {
  const dist = pointDistance(p1, p2);

  // If points are too close, create a circle at the midpoint
  if (dist < MIN_POINT_DISTANCE) {
    const avgRadius = (r1 + r2) / 2;
    return polygonFromPoints<P>(
      generateArcPoints(p1, avgRadius, 0, Math.PI * 2, CAP_SEGMENTS * 2),
    );
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
  const purePerpAngle = baseAngle + Math.PI / 2;

  // Cap at p1 (semicircle facing AWAY from p2, i.e., toward baseAngle + PI)
  // Use perpendicular cap for stroke start, otherwise use tangent-adjusted
  const p1PerpAngle = forcePerpendicularCap1 ? purePerpAngle : tangentPerpAngle;
  const p1RightAngle = p1PerpAngle;
  const p1LeftAngle = p1PerpAngle + Math.PI;
  const cap1Points = generateArcPoints<P>(
    p1,
    r1,
    p1RightAngle,
    p1LeftAngle,
    CAP_SEGMENTS,
  );

  // Cap at p2 (semicircle facing AWAY from p1, i.e., toward baseAngle)
  // Use perpendicular cap for stroke end, otherwise use tangent-adjusted
  const p2PerpAngle = forcePerpendicularCap2 ? purePerpAngle : tangentPerpAngle;
  const p2LeftAngle = p2PerpAngle + Math.PI;
  const p2RightAngle = p2LeftAngle + Math.PI;
  const cap2Points = generateArcPoints<P>(
    p2,
    r2,
    p2LeftAngle,
    p2RightAngle,
    CAP_SEGMENTS,
  );

  // Assemble the ovoid polygon:
  // cap1 goes around the back of p1, cap2 goes around the front of p2
  // The arc endpoints naturally connect with the tangent lines
  const ovoidPoints: P[] = [
    ...cap1Points, // p1's back cap
    ...cap2Points, // p2's front cap
  ];

  // Filter out near-duplicate consecutive points to avoid numerical issues
  return polygonFromPoints<P>(filterNearDuplicates<P>(ovoidPoints));
}

/**
 * Filter out consecutive points that are too close together.
 * This prevents numerical instability in polygon boolean operations.
 */
function filterNearDuplicates<P extends LocalPoint | GlobalPoint>(
  points: P[],
): P[] {
  if (points.length < 2) {
    return points;
  }

  const filtered: P[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const distSq = dx * dx + dy * dy;

    // Only add if far enough from previous point
    if (distSq > EPSILON * EPSILON) {
      filtered.push(curr);
    }
  }

  // Also check if last point is too close to first point
  if (filtered.length > 2) {
    const first = filtered[0];
    const last = filtered[filtered.length - 1];
    const dx = last[0] - first[0];
    const dy = last[1] - first[1];
    const distSq = dx * dx + dy * dy;

    if (distSq < EPSILON * EPSILON) {
      filtered.pop();
    }
  }

  return filtered.length >= 3 ? filtered : points;
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
  const { x, y, points, pressures, simulatePressure, strokeWidth } = element;

  // Debug draw the raw segments from the freedraw element points
  const colors = ["red", "green", "blue", "orange", "purple"];

  points.forEach((pt, i) => {
    if (i === points.length - 1) {
      return;
    }
    debugDrawLine(
      lineSegment(
        pointFrom<GlobalPoint>(x + pt[0], y + pt[1]),
        pointFrom<GlobalPoint>(x + points[i + 1][0], y + points[i + 1][1]),
      ),
      {
        color: colors[i % colors.length],
        permanent: true,
      },
    );
  });

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
  const ovoids: Polygon<LocalPoint>[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i] as LocalPoint;
    const p2 = points[i + 1] as LocalPoint;

    // Get pressures (use 0.5 as default when simulating)
    const pressure1 = simulatePressure ? 0.5 : pressures[i] ?? 0.5;
    const pressure2 = simulatePressure ? 0.5 : pressures[i + 1] ?? 0.5;

    const r1 = getRadiusForPressure(pressure1, strokeWidth);
    const r2 = getRadiusForPressure(pressure2, strokeWidth);

    // Force perpendicular caps at stroke endpoints
    const isFirstSegment = i === 0;
    const isLastSegment = i === points.length - 2;

    const ovoidPoints = createOvoid<LocalPoint>(
      p1,
      r1,
      p2,
      r2,
      isFirstSegment, // Force perpendicular cap at stroke start
      isLastSegment, // Force perpendicular cap at stroke end
    );

    // Draw the ovoid with different colors for debugging
    debugDrawPolygon(
      ovoidPoints.map((p) => pointFrom<GlobalPoint>(x + p[0], y + p[1])),
      {
        color: colors[i % colors.length],
        permanent: true,
      },
    );

    if (ovoidPoints.length >= 3) {
      ovoids.push(ovoidPoints);
    }
  }

  if (ovoids.length === 0) {
    return [];
  }

  // Union all ovoids together
  const result = chainOvoidsIntoSinglePolygon<LocalPoint>(
    ovoids.map((poly, i) => ({
      polygon: poly,
      firstPoint: points[i],
      secondPoint: points[i + 1],
    })),
  );

  if (result === null) {
    return [];
  }

  if (result === null) {
    return [];
  }

  // Return the first (outer) polygon
  return result;
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
