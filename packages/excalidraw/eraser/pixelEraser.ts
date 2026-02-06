import { newElementWith } from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import { nanoid } from "nanoid";

import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";
import type { GlobalPoint, LocalPoint } from "@excalidraw/math/types";

type Point = [number, number];

const distance2d = (p1: Point, p2: Point) => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// Checks if a point is inside a circle
const isPointInCircle = (p: Point, center: Point, radius: number) => {
  return distance2d(p, center) <= radius;
};

// Intersect a line segment (p1-p2) with a circle (center, radius).
// Returns 0, 1, or 2 points of intersection.
const intersectSegmentCircle = (
  p1: Point,
  p2: Point,
  center: Point,
  radius: number,
): Point[] => {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const fx = p1[0] - center[0];
  const fy = p1[1] - center[1];

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  let discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return [];
  }

  discriminant = Math.sqrt(discriminant);

  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  const points: Point[] = [];

  if (t1 >= 0 && t1 <= 1) {
    points.push([p1[0] + t1 * dx, p1[1] + t1 * dy]);
  }
  if (t2 >= 0 && t2 <= 1) {
    points.push([p1[0] + t2 * dx, p1[1] + t2 * dy]);
  }

  return points;
};

/**
 * Erases a specialized "capsule" area (line segment + radius) from a FreeDraw element.
 * It essentially subtracts the eraser path from the freedraw points.
 *
 * @param element The target FreeDraw element
 * @param eraserPath The last two points of the eraser trail (forming a segment)
 * @param zoom Current app zoom (used to adjust eraser size if needed, though usually fixed)
 * @returns Array of new FreeDraw elements (fragments). Could be 0 (fully erased), 1 (trimmed), or 2+ (split).
 */
export const erasePixelFromFreeDraw = (
  element: ExcalidrawFreeDrawElement,
  eraserPath: GlobalPoint[],
  zoom: number,
): ExcalidrawFreeDrawElement[] => {
  if (eraserPath.length < 2) {
    return [element];
  }

  // Eraser is treated as a line segment between the last two recorded points
  // with a certain "radius" of effect.
  // Note: App.tsx uses `size` property for eraser, we can approximate or pass it in.
  // Standard eraser size is often around 10-20px visually.
  const ERASER_RADIUS = 10 / zoom;

  const p2 = eraserPath[eraserPath.length - 1];

  // We'll treat the eraser interaction as checking against circles at p1 and p2
  // and the rectangle between them. For simplicity in this first pass,
  // we can check against the circle at p2 (current tip) and maybe p1.
  // "Pixel" erasing usually feels best if we just erode what's under the cursor *now*.
  // So let's start by erasing against the Circle at p2.
  // If the user moves fast, we might need to sweep the whole segment.

  // Let's implement the "Sweep" (Capsule) erasure for better continuity.
  // But strictly speaking, if we run this on every pointer move,
  // checking the circle at the current pointer is often sufficient and simpler/faster.
  // Let's try Circle at P2 first.

  const eraserCenter: Point = [p2[0], p2[1]];
  const radius = ERASER_RADIUS;

  // Convert element points to global logic for intersection
  // FreeDraw points are offsets from [element.x, element.y]
  const elementX = element.x;
  const elementY = element.y;

  const globalPoints: Point[] = element.points.map((p) => [
    elementX + p[0],
    elementY + p[1],
  ]);

  // We will build a list of "segments" (lists of points).
  // Initially we have one segment (the whole line).
  // As we find intersections, we break the current segment.
  const fragments: Point[][] = [];
  let currentFragment: Point[] = [];

  for (let i = 0; i < globalPoints.length - 1; i++) {
    const A = globalPoints[i];
    const B = globalPoints[i + 1];

    const A_in = isPointInCircle(A, eraserCenter, radius);
    const B_in = isPointInCircle(B, eraserCenter, radius);

    if (A_in && B_in) {
      // Entire segment is erased.
      if (currentFragment.length > 0) {
        fragments.push(currentFragment);
        currentFragment = [];
      }
      continue;
    }

    if (!A_in && !B_in) {
      // Both endpoints outside. Check if line intersects circle.
      const intersections = intersectSegmentCircle(A, B, eraserCenter, radius);

      if (intersections.length === 2) {
        // Enters and exits the circle.
        // A -> int1 (break) int2 -> B

        // Add A if starting fresh or continuing
        if (currentFragment.length === 0) {
          currentFragment.push(A);
        } else if (currentFragment[currentFragment.length - 1] !== A) {
          // Should happen automatically by logic below, but good to be safe
          currentFragment.push(A);
        }

        currentFragment.push(intersections[0]);
        fragments.push(currentFragment);
        currentFragment = [intersections[1], B];
      } else {
        // No intersection or just tangent/one point (unlikely to split effectively)
        // just keep A->B
        if (currentFragment.length === 0) {
          currentFragment.push(A);
        }
        currentFragment.push(B);
      }
      continue;
    }

    // One inside, one outside
    const intersections = intersectSegmentCircle(A, B, eraserCenter, radius);
    const intersection = intersections[0]; // Should be exactly 1 unless tangent quirks

    if (A_in && !B_in) {
      // Starts inside (erased), exits to B.
      // Eraser -> int -> B
      if (currentFragment.length > 0) {
        fragments.push(currentFragment);
        currentFragment = [];
      }
      if (intersection) {
        currentFragment.push(intersection);
      }
      currentFragment.push(B);
    } else if (!A_in && B_in) {
      // Starts outside (kept), enters eraser.
      // A -> int -> Eraser
      if (currentFragment.length === 0) {
        currentFragment.push(A);
      }
      if (intersection) {
        currentFragment.push(intersection);
      }
      fragments.push(currentFragment);
      currentFragment = [];
    }
  }

  // Handle the very last point if the loop finished with an open fragment
  if (currentFragment.length > 0) {
    fragments.push(currentFragment);
  }

  // If no split happened and points count is unchanged (approx), return original
  // But checking "unchanged" is hard with floating point intersections.
  // Actually, we can check if `fragments.length === 1` and `fragments[0].length == globalPoints.length`
  // as a cheap optimization, but new points might be added (intersections).

  if (fragments.length === 0) {
    return []; // Fully erased
  }

  // Reconstruct Excalidraw Elements from fragments
  const newElements: ExcalidrawFreeDrawElement[] = fragments.map(
    (fragmentPoints, index) => {
      // We need to re-normalize points relative to a new bounding box (x,y)
      let minX = Infinity;
      let minY = Infinity;

      fragmentPoints.forEach(([x, y]) => {
        if (x < minX) {
          minX = x;
        }
        if (y < minY) {
          minY = y;
        }
      });

      const localPoints: LocalPoint[] = fragmentPoints.map(([x, y]) =>
        pointFrom(x - minX, y - minY),
      );

      const pressures = new Array(localPoints.length).fill(
        element.pressures[0] || 0.5,
      );
      // Ideally we interpolate pressures, but constant or carrying over is okay for MVP

      return newElementWith(element, {
        x: minX,
        y: minY,
        points: localPoints,
        pressures,
        width: 0, // Will be recalculated below
        id: index === 0 ? element.id : nanoid(), // Keep original ID for first fragment, new IDs for others
      } as any);
    },
  );

  // Fix dimensions for new elements
  newElements.forEach((el) => {
    // Calculate W/H
    let maxX = -Infinity;
    let maxY = -Infinity;
    el.points.forEach(([x, y]) => {
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    });
    (el as any).width = maxX; // since min is 0
    (el as any).height = maxY;
  });

  return newElements;
};
