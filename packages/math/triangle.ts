import type { GlobalPoint, LocalPoint, Triangle } from "./types";

// Types

/**
 * Tests if a point lies inside a triangle. This function
 * will return FALSE if the point lies exactly on the sides
 * of the triangle.
 *
 * @param triangle The triangle to test the point for
 * @param p The point to test whether is in the triangle
 * @returns TRUE if the point is inside of the triangle
 */
export function triangleIncludesPoint<P extends GlobalPoint | LocalPoint>(
  [a, b, c]: Triangle<P>,
  p: P,
): boolean {
  const triangleSign = (p1: P, p2: P, p3: P) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = triangleSign(p, a, b);
  const d2 = triangleSign(p, b, c);
  const d3 = triangleSign(p, c, a);

  const has_neg = d1 < 0 || d2 < 0 || d3 < 0;
  const has_pos = d1 > 0 || d2 > 0 || d3 > 0;

  return !(has_neg && has_pos);
}
