import { radians } from "./angle";
import { line } from "./line";
import {
  point,
  pointDistance,
  pointFromVector,
  pointRotateRads,
} from "./point";
import type { Ellipse, GenericPoint, Segment, Radians } from "./types";
import { PRECISION } from "./utils";
import {
  vector,
  vectorAdd,
  vectorDot,
  vectorFromPoint,
  vectorScale,
} from "./vector";

/**
 * Construct an Ellipse object from the parameters
 *
 * @param center The center of the ellipse
 * @param angle The slanting of the ellipse in radians
 * @param halfWidth Half of the width of a non-slanted version of the ellipse
 * @param halfHeight Half of the height of a non-slanted version of the ellipse
 * @returns The constructed Ellipse object
 */
export function ellipse<Point extends GenericPoint>(
  center: Point,
  angle: Radians,
  halfWidth: number,
  halfHeight: number,
): Ellipse<Point> {
  return {
    center,
    angle,
    halfWidth,
    halfHeight,
  } as Ellipse<Point>;
}

/**
 * Determines if a point is inside or on the ellipse outline
 *
 * @param p The point to test
 * @param ellipse The ellipse to compare against
 * @returns TRUE if the point is inside or on the outline of the ellipse
 */
export const ellipseIncludesPoint = <Point extends GenericPoint>(
  p: Point,
  ellipse: Ellipse<Point>,
) => {
  const { center, angle, halfWidth, halfHeight } = ellipse;
  const translatedPoint = vectorAdd(
    vectorFromPoint(p),
    vectorScale(vectorFromPoint(center), -1),
  );
  const [rotatedPointX, rotatedPointY] = pointRotateRads(
    pointFromVector(translatedPoint),
    point(0, 0),
    radians(-angle),
  );

  return (
    (rotatedPointX / halfWidth) * (rotatedPointX / halfWidth) +
      (rotatedPointY / halfHeight) * (rotatedPointY / halfHeight) <=
    1
  );
};

/**
 * Tests whether a point lies on the outline of the ellipse within a given
 * tolerance
 *
 * @param point The point to test
 * @param ellipse The ellipse to compare against
 * @param threshold The distance to consider a point close enough to be "on" the outline
 * @returns TRUE if the point is on the ellise outline
 */
export const ellipseTouchesPoint = <Point extends GenericPoint>(
  point: Point,
  ellipse: Ellipse<Point>,
  threshold = PRECISION,
) => {
  return ellipseDistanceFromPoint(point, ellipse) <= threshold;
};

/**
 * Determine the shortest euclidean distance from a point to the
 * outline of the ellipse
 *
 * @param p The point to consider
 * @param ellipse The ellipse to calculate the distance to
 * @returns The eucledian distance
 */
export const ellipseDistanceFromPoint = <Point extends GenericPoint>(
  p: Point,
  ellipse: Ellipse<Point>,
): number => {
  const { angle, halfWidth, halfHeight, center } = ellipse;
  const a = halfWidth;
  const b = halfHeight;
  const translatedPoint = vectorAdd(
    vectorFromPoint(p),
    vectorScale(vectorFromPoint(center), -1),
  );
  const [rotatedPointX, rotatedPointY] = pointRotateRads(
    pointFromVector(translatedPoint),
    point(0, 0),
    radians(-angle),
  );

  const px = Math.abs(rotatedPointX);
  const py = Math.abs(rotatedPointY);

  let tx = 0.707;
  let ty = 0.707;

  for (let i = 0; i < 3; i++) {
    const x = a * tx;
    const y = b * ty;

    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;

    const rx = x - ex;
    const ry = y - ey;

    const qx = px - ex;
    const qy = py - ey;

    const r = Math.hypot(ry, rx);
    const q = Math.hypot(qy, qx);

    tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
    ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
    const t = Math.hypot(ty, tx);
    tx /= t;
    ty /= t;
  }

  const [minX, minY] = [
    a * tx * Math.sign(rotatedPointX),
    b * ty * Math.sign(rotatedPointY),
  ];

  return pointDistance(point(rotatedPointX, rotatedPointY), point(minX, minY));
};

/**
 * Calculate a maximum of two intercept points for a line going throug an
 * ellipse.
 */
export function ellipseSegmentInterceptPoints<Point extends GenericPoint>(
  e: Readonly<Ellipse<Point>>,
  l: Readonly<Segment<Point>>,
): Point[] {
  const rx = e.halfWidth;
  const ry = e.halfHeight;
  const nonRotatedLine = line(
    pointRotateRads(l[0], e.center, radians(-e.angle)),
    pointRotateRads(l[1], e.center, radians(-e.angle)),
  );
  const dir = vectorFromPoint(nonRotatedLine[1], nonRotatedLine[0]);
  const diff = vector(
    nonRotatedLine[0][0] - e.center[0],
    nonRotatedLine[0][1] - e.center[1],
  );
  const mDir = vector(dir[0] / (rx * rx), dir[1] / (ry * ry));
  const mDiff = vector(diff[0] / (rx * rx), diff[1] / (ry * ry));

  const a = vectorDot(dir, mDir);
  const b = vectorDot(dir, mDiff);
  const c = vectorDot(diff, mDiff) - 1.0;
  const d = b * b - a * c;

  const intersections: Point[] = [];

  if (d > 0) {
    const t_a = (-b - Math.sqrt(d)) / a;
    const t_b = (-b + Math.sqrt(d)) / a;

    if (0 <= t_a && t_a <= 1) {
      intersections.push(
        point(
          nonRotatedLine[0][0] +
            (nonRotatedLine[1][0] - nonRotatedLine[0][0]) * t_a,
          nonRotatedLine[0][1] +
            (nonRotatedLine[1][1] - nonRotatedLine[0][1]) * t_a,
        ),
      );
    }

    if (0 <= t_b && t_b <= 1) {
      intersections.push(
        point(
          nonRotatedLine[0][0] +
            (nonRotatedLine[1][0] - nonRotatedLine[0][0]) * t_b,
          nonRotatedLine[0][1] +
            (nonRotatedLine[1][1] - nonRotatedLine[0][1]) * t_b,
        ),
      );
    }
  } else if (d === 0) {
    const t = -b / a;
    if (0 <= t && t <= 1) {
      intersections.push(
        point(
          nonRotatedLine[0][0] +
            (nonRotatedLine[1][0] - nonRotatedLine[0][0]) * t,
          nonRotatedLine[0][1] +
            (nonRotatedLine[1][1] - nonRotatedLine[0][1]) * t,
        ),
      );
    }
  }

  return intersections.map((point) =>
    pointRotateRads(point, e.center, e.angle),
  );
}
