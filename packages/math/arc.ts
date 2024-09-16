import { cartesian2Polar } from "./angle";
import type { GlobalPoint, LocalPoint, SymmetricArc } from "./types";
import { PRECISION } from "./utils";

/**
 * Determines if a cartesian point lies on a symmetric arc, i.e. an arc which
 * is part of a circle contour centered on 0, 0.
 */
export const isPointOnSymmetricArc = <P extends GlobalPoint | LocalPoint>(
  { radius: arcRadius, startAngle, endAngle }: SymmetricArc,
  point: P,
): boolean => {
  const [radius, angle] = cartesian2Polar(point);

  return startAngle < endAngle
    ? Math.abs(radius - arcRadius) < PRECISION &&
        startAngle <= angle &&
        endAngle >= angle
    : startAngle <= angle || endAngle >= angle;
};
