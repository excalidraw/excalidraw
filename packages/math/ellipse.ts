import { radians } from "./angle";
import { line } from "./line";
import {
  point,
  pointDistance,
  pointFromVector,
  pointRotateRads,
} from "./point";
import type { Ellipse, GenericPoint, Line } from "./types";
import { PRECISION } from "./utils";
import {
  vector,
  vectorAdd,
  vectorDot,
  vectorFromPoint,
  vectorScale,
} from "./vector";

export const pointInEllipse = <Point extends GenericPoint>(
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

export const pointOnEllipse = <Point extends GenericPoint>(
  point: Point,
  ellipse: Ellipse<Point>,
  threshold = PRECISION,
) => {
  return distanceToEllipse(point, ellipse) <= threshold;
};

export const ellipseAxes = <Point extends GenericPoint>(
  ellipse: Ellipse<Point>,
) => {
  const widthGreaterThanHeight = ellipse.halfWidth > ellipse.halfHeight;

  const majorAxis = widthGreaterThanHeight
    ? ellipse.halfWidth * 2
    : ellipse.halfHeight * 2;
  const minorAxis = widthGreaterThanHeight
    ? ellipse.halfHeight * 2
    : ellipse.halfWidth * 2;

  return {
    majorAxis,
    minorAxis,
  };
};

export const ellipseFocusToCenter = <Point extends GenericPoint>(
  ellipse: Ellipse<Point>,
) => {
  const { majorAxis, minorAxis } = ellipseAxes(ellipse);

  return Math.sqrt(majorAxis ** 2 - minorAxis ** 2);
};

export const ellipseExtremes = <Point extends GenericPoint>(
  ellipse: Ellipse<Point>,
) => {
  const { center, angle } = ellipse;
  const { majorAxis, minorAxis } = ellipseAxes(ellipse);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const sqSum = majorAxis ** 2 + minorAxis ** 2;
  const sqDiff = (majorAxis ** 2 - minorAxis ** 2) * Math.cos(2 * angle);

  const yMax = Math.sqrt((sqSum - sqDiff) / 2);
  const xAtYMax =
    (yMax * sqSum * sin * cos) /
    (majorAxis ** 2 * sin ** 2 + minorAxis ** 2 * cos ** 2);

  const xMax = Math.sqrt((sqSum + sqDiff) / 2);
  const yAtXMax =
    (xMax * sqSum * sin * cos) /
    (majorAxis ** 2 * cos ** 2 + minorAxis ** 2 * sin ** 2);
  const centerVector = vectorFromPoint(center);

  return [
    vectorAdd(vector(xAtYMax, yMax), centerVector),
    vectorAdd(vectorScale(vector(xAtYMax, yMax), -1), centerVector),
    vectorAdd(vector(xMax, yAtXMax), centerVector),
    vectorAdd(vector(xMax, yAtXMax), centerVector),
  ];
};

const distanceToEllipse = <Point extends GenericPoint>(
  p: Point,
  ellipse: Ellipse<Point>,
) => {
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
export function interceptPointsOfLineAndEllipse<Point extends GenericPoint>(
  ellipse: Readonly<Ellipse<Point>>,
  l: Readonly<Line<Point>>,
): Point[] {
  const rx = ellipse.halfWidth;
  const ry = ellipse.halfHeight;
  const nonRotatedLine = line(
    pointRotateRads(l[0], ellipse.center, radians(-ellipse.angle)),
    pointRotateRads(l[1], ellipse.center, radians(-ellipse.angle)),
  );
  const dir = vectorFromPoint(nonRotatedLine[1], nonRotatedLine[0]);
  const diff = vector(
    nonRotatedLine[0][0] - ellipse.center[0],
    nonRotatedLine[0][1] - ellipse.center[1],
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
    pointRotateRads(point, ellipse.center, ellipse.angle),
  );
}
