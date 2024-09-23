import { cartesian2Polar } from "./angle";
import type { GenericPoint, Radians, SymmetricArc } from "./types";
import { PRECISION } from "./utils";

/**
 * Constructs a symmetric arc defined by the originating circle radius
 * the start angle and end angle with 0 radians being the "northest" point
 * of the circle.
 *
 * @param radius The radius of the circle this arc lies on
 * @param startAngle The start angle with 0 radians being the "northest" point
 * @param endAngle The end angle with 0 radians being the "northest" point
 * @returns The constructed symmetric arc
 */
export function arc(radius: number, startAngle: Radians, endAngle: Radians) {
  return { radius, startAngle, endAngle } as SymmetricArc;
}

/**
 * Determines if a cartesian point lies on a symmetric arc, i.e. an arc which
 * is part of a circle contour centered on 0, 0.
 */
export function isPointOnSymmetricArc<P extends GenericPoint>(
  { radius: arcRadius, startAngle, endAngle }: SymmetricArc,
  point: P,
): boolean {
  const [radius, angle] = cartesian2Polar(point);

  return startAngle < endAngle
    ? Math.abs(radius - arcRadius) < PRECISION &&
        startAngle <= angle &&
        endAngle >= angle
    : startAngle <= angle || endAngle >= angle;
}
