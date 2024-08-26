import type { GlobalPoint, LocalPoint, SymmetricArc } from "./types";
import { carthesian2Polar } from "./utils";

/**
 * Determines if a carthesian point lies on a symmetric arc, i.e. an arc which
 * is part of a circle contour centered on 0, 0.
 */
export const isPointOnSymmetricArc = <P extends GlobalPoint | LocalPoint>(
  { radius: arcRadius, startAngle, endAngle }: SymmetricArc,
  point: P,
): boolean => {
  const [radius, angle] = carthesian2Polar(point);

  return startAngle < endAngle
    ? Math.abs(radius - arcRadius) < 0.0000001 &&
        startAngle <= angle &&
        endAngle >= angle
    : startAngle <= angle || endAngle >= angle;
};
