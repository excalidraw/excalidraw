import { cartesian2Polar, normalizeRadians } from "./angle";
import {
  ellipse,
  ellipseDistanceFromPoint,
  ellipseLineIntersectionPoints,
  ellipseSegmentInterceptPoints,
} from "./ellipse";
import { pointFrom, pointDistance, isPoint } from "./point";
import type {
  GlobalPoint,
  LocalPoint,
  Radians,
  Arc,
  Line,
  LineSegment,
} from "./types";
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
export function arc<Point extends GlobalPoint | LocalPoint>(
  center: Point,
  radius: number,
  startAngle: Radians,
  endAngle: Radians,
) {
  const start = normalizeRadians(startAngle);
  const end = normalizeRadians(endAngle);

  return { center, radius, startAngle: start, endAngle: end } as Arc<Point>;
}

/**
 * Determines if a cartesian point lies on a symmetric arc, i.e. an arc which
 * is part of a circle contour centered on 0, 0.
 */
export function arcIncludesPoint<P extends GlobalPoint | LocalPoint>(
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
export function arcDistanceFromPoint<Point extends GlobalPoint | LocalPoint>(
  a: Arc<Point>,
  p: Point,
) {
  const theta = normalizeRadians(
    Math.atan2(p[0] - a.center[0], p[1] - a.center[1]) as Radians,
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
export function arcSegmentInterceptPoints<
  Point extends GlobalPoint | LocalPoint,
>(a: Readonly<Arc<Point>>, s: Readonly<LineSegment<Point>>): Point[] {
  return ellipseSegmentInterceptPoints(
    ellipse(a.center, a.radius, a.radius),
    s,
  ).filter((candidate: Point) => {
    const [candidateRadius, candidateAngle] = cartesian2Polar(
      pointFrom(candidate[0] - a.center[0], candidate[1] - a.center[1]),
    );

    return Math.abs(a.radius - candidateRadius) < PRECISION &&
      a.startAngle > a.endAngle
      ? a.startAngle <= candidateAngle || a.endAngle >= candidateAngle
      : a.startAngle <= candidateAngle && a.endAngle >= candidateAngle;
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
export function arcLineInterceptPoints<Point extends GlobalPoint>(
  a: Readonly<Arc<Point>>,
  l: Readonly<Line<Point>>,
): Point[] {
  return ellipseLineIntersectionPoints(
    ellipse(a.center, a.radius, a.radius),
    l,
  ).filter((candidate: Point) => {
    const [candidateRadius, candidateAngle] = cartesian2Polar(
      pointFrom(candidate[0] - a.center[0], candidate[1] - a.center[1]),
    );

    return Math.abs(a.radius - candidateRadius) < PRECISION &&
      a.startAngle > a.endAngle
      ? a.startAngle <= candidateAngle || a.endAngle >= candidateAngle
      : a.startAngle <= candidateAngle && a.endAngle >= candidateAngle;
  });
}

export function isArc<Point extends GlobalPoint | LocalPoint>(
  v: unknown,
): v is Arc<Point> {
  return (
    v != null &&
    typeof v === "object" &&
    Object.hasOwn(v, "center") &&
    Object.hasOwn(v, "radius") &&
    Object.hasOwn(v, "startAngle") &&
    Object.hasOwn(v, "endAngle") &&
    isPoint((v as Arc<Point>).center) &&
    typeof (v as Arc<Point>).radius === "number" &&
    typeof (v as Arc<Point>).startAngle === "number" &&
    typeof (v as Arc<Point>).endAngle === "number"
  );
}
