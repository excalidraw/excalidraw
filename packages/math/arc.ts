import { cartesian2Polar, normalizeRadians, radians } from "./angle";
import {
  ellipse,
  ellipseDistanceFromPoint,
  ellipseLineIntersectionPoints,
  ellipseSegmentInterceptPoints,
} from "./ellipse";
import { pointFrom, pointDistance } from "./point";
import type { GenericPoint, Segment, Radians, Arc, Line } from "./types";
import { PRECISION } from "./utils";

/**
 * Constructs a symmetric arc defined by the originating circle radius
 * the start angle and end angle with 0 radians being the most "eastward" point
 * of the circle.
 *
 * @param radius The radius of the circle this arc lies on
 * @param startAngle The start angle with 0 radians being the most "eastward" point
 * @param endAngle The end angle with 0 radians being the "northest" point
 * @returns The constructed symmetric arc
 */
export function arc<Point extends GenericPoint>(
  center: Point,
  radius: number,
  startAngle: Radians,
  endAngle: Radians,
) {
  return { center, radius, startAngle, endAngle } as Arc<Point>;
}

/**
 * Determines if a cartesian point lies on a symmetric arc, i.e. an arc which
 * is part of a circle contour centered on 0, 0.
 */
export function arcIncludesPoint<P extends GenericPoint>(
  { center, radius: arcRadius, startAngle, endAngle }: Arc<P>,
  p: P,
): boolean {
  const [radius, angle] = cartesian2Polar(
    pointFrom(p[0] - center[0], p[1] - center[1]),
  );

  return startAngle < endAngle
    ? Math.abs(radius - arcRadius) < PRECISION &&
        startAngle <= angle &&
        endAngle >= angle
    : startAngle <= angle || endAngle >= angle;
}

/**
 *
 * @param a
 * @param p
 */
export function arcDistanceFromPoint<Point extends GenericPoint>(
  a: Arc<Point>,
  p: Point,
) {
  const theta = normalizeRadians(
    radians(Math.atan2(p[0] - a.center[0], p[1] - a.center[1])),
  );

  if (a.startAngle <= theta && a.endAngle >= theta) {
    return ellipseDistanceFromPoint(
      p,
      ellipse(a.center, 2 * a.radius, 2 * a.radius),
    );
  }
  return Math.min(
    pointDistance(
      p,
      pointFrom(
        a.center[0] + a.radius + Math.cos(a.startAngle),
        a.center[1] + a.radius + Math.sin(a.startAngle),
      ),
    ),
    pointDistance(
      p,
      pointFrom(
        a.center[0] + a.radius + Math.cos(a.endAngle),
        a.center[1] + a.radius + Math.sin(a.endAngle),
      ),
    ),
  );
}

/**
 * Returns the intersection point(s) of a line segment represented by a start
 * point and end point and a symmetric arc
 */
export function arcSegmentInterceptPoints<Point extends GenericPoint>(
  a: Readonly<Arc<Point>>,
  s: Readonly<Segment<Point>>,
): Point[] {
  return ellipseSegmentInterceptPoints(
    ellipse(a.center, a.radius, a.radius),
    s,
  ).filter((candidate) => {
    const [candidateRadius, candidateAngle] = cartesian2Polar(
      pointFrom(candidate[0] - a.center[0], candidate[1] - a.center[1]),
    );

    return a.startAngle < a.endAngle
      ? Math.abs(a.radius - candidateRadius) < PRECISION &&
          a.startAngle <= candidateAngle &&
          a.endAngle >= candidateAngle
      : a.startAngle <= candidateAngle || a.endAngle >= candidateAngle;
  });
}

/**
 * Returns the intersection point(s) of a line segment represented by a start
 * point and end point and a symmetric arc
 *
 * @param a
 * @param l
 * @returns
 */
export function arcLineInterceptPoints<Point extends GenericPoint>(
  a: Readonly<Arc<Point>>,
  l: Readonly<Line<Point>>,
): Point[] {
  return ellipseLineIntersectionPoints(
    ellipse(a.center, a.radius, a.radius),
    l,
  ).filter((candidate) => {
    const [candidateRadius, candidateAngle] = cartesian2Polar(
      pointFrom(candidate[0] - a.center[0], candidate[1] - a.center[1]),
    );

    return a.startAngle < a.endAngle
      ? Math.abs(a.radius - candidateRadius) < PRECISION &&
          a.startAngle <= candidateAngle &&
          a.endAngle >= candidateAngle
      : a.startAngle <= candidateAngle || a.endAngle >= candidateAngle;
  });
}
