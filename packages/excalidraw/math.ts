import type { NormalizedZoomValue, Point, Zoom } from "./types";
import {
  DEFAULT_ADAPTIVE_RADIUS,
  LINE_CONFIRM_THRESHOLD,
  DEFAULT_PROPORTIONAL_RADIUS,
  ROUNDNESS,
} from "./constants";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "./element/types";
import { getCurvePathOps } from "./element/bounds";
import type { Mutable } from "./utility-types";
import { ShapeCache } from "./scene/ShapeCache";

export const rotate = (
  // target point to rotate
  x: number,
  y: number,
  // point to rotate against
  cx: number,
  cy: number,
  angle: number,
): [number, number] =>
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  [
    (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
    (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy,
  ];

export const rotatePoint = (
  point: Point,
  center: Point,
  angle: number,
): [number, number] => rotate(point[0], point[1], center[0], center[1], angle);

export const adjustXYWithRotation = (
  sides: {
    n?: boolean;
    e?: boolean;
    s?: boolean;
    w?: boolean;
  },
  x: number,
  y: number,
  angle: number,
  deltaX1: number,
  deltaY1: number,
  deltaX2: number,
  deltaY2: number,
): [number, number] => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (sides.e && sides.w) {
    x += deltaX1 + deltaX2;
  } else if (sides.e) {
    x += deltaX1 * (1 + cos);
    y += deltaX1 * sin;
    x += deltaX2 * (1 - cos);
    y += deltaX2 * -sin;
  } else if (sides.w) {
    x += deltaX1 * (1 - cos);
    y += deltaX1 * -sin;
    x += deltaX2 * (1 + cos);
    y += deltaX2 * sin;
  }

  if (sides.n && sides.s) {
    y += deltaY1 + deltaY2;
  } else if (sides.n) {
    x += deltaY1 * sin;
    y += deltaY1 * (1 - cos);
    x += deltaY2 * -sin;
    y += deltaY2 * (1 + cos);
  } else if (sides.s) {
    x += deltaY1 * -sin;
    y += deltaY1 * (1 + cos);
    x += deltaY2 * sin;
    y += deltaY2 * (1 - cos);
  }
  return [x, y];
};

export const getPointOnAPath = (point: Point, path: Point[]) => {
  const [px, py] = point;
  const [start, ...other] = path;
  let [lastX, lastY] = start;
  let kLine: number = 0;
  let idx: number = 0;

  // if any item in the array is true, it means that a point is
  // on some segment of a line based path
  const retVal = other.some(([x2, y2], i) => {
    // we always take a line when dealing with line segments
    const x1 = lastX;
    const y1 = lastY;

    lastX = x2;
    lastY = y2;

    // if a point is not within the domain of the line segment
    // it is not on the line segment
    if (px < x1 || px > x2) {
      return false;
    }

    // check if all points lie on the same line
    // y1 = kx1 + b, y2 = kx2 + b
    // y2 - y1 = k(x2 - x2) -> k = (y2 - y1) / (x2 - x1)

    // coefficient for the line (p0, p1)
    const kL = (y2 - y1) / (x2 - x1);

    // coefficient for the line segment (p0, point)
    const kP1 = (py - y1) / (px - x1);

    // coefficient for the line segment (point, p1)
    const kP2 = (py - y2) / (px - x2);

    // because we are basing both lines from the same starting point
    // the only option for collinearity is having same coefficients

    // using it for floating point comparisons
    const epsilon = 0.3;

    // if coefficient is more than an arbitrary epsilon,
    // these lines are nor collinear
    if (Math.abs(kP1 - kL) > epsilon && Math.abs(kP2 - kL) > epsilon) {
      return false;
    }

    // store the coefficient because we are goint to need it
    kLine = kL;
    idx = i;

    return true;
  });

  // Return a coordinate that is always on the line segment
  if (retVal === true) {
    return { x: point[0], y: kLine * point[0], segment: idx };
  }

  return null;
};

export const distance2d = (x1: number, y1: number, x2: number, y2: number) => {
  const xd = x2 - x1;
  const yd = y2 - y1;
  return Math.hypot(xd, yd);
};

export const centerPoint = (a: Point, b: Point): Point => {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
};

// Checks if the first and last point are close enough
// to be considered a loop
export const isPathALoop = (
  points: ExcalidrawLinearElement["points"],
  /** supply if you want the loop detection to account for current zoom */
  zoomValue: Zoom["value"] = 1 as NormalizedZoomValue,
): boolean => {
  if (points.length >= 3) {
    const [first, last] = [points[0], points[points.length - 1]];
    const distance = distance2d(first[0], first[1], last[0], last[1]);

    // Adjusting LINE_CONFIRM_THRESHOLD to current zoom so that when zoomed in
    // really close we make the threshold smaller, and vice versa.
    return distance <= LINE_CONFIRM_THRESHOLD / zoomValue;
  }
  return false;
};

// Draw a line from the point to the right till infiinty
// Check how many lines of the polygon does this infinite line intersects with
// If the number of intersections is odd, point is in the polygon
export const isPointInPolygon = (
  points: Point[],
  x: number,
  y: number,
): boolean => {
  const vertices = points.length;

  // There must be at least 3 vertices in polygon
  if (vertices < 3) {
    return false;
  }
  const extreme: Point = [Number.MAX_SAFE_INTEGER, y];
  const p: Point = [x, y];
  let count = 0;
  for (let i = 0; i < vertices; i++) {
    const current = points[i];
    const next = points[(i + 1) % vertices];
    if (doSegmentsIntersect(current, next, p, extreme)) {
      if (orderedColinearOrientation(current, p, next) === 0) {
        return isPointWithinBounds(current, p, next);
      }
      count++;
    }
  }
  // true if count is off
  return count % 2 === 1;
};

// Returns whether `q` lies inside the segment/rectangle defined by `p` and `r`.
// This is an approximation to "does `q` lie on a segment `pr`" check.
export const isPointWithinBounds = (p: Point, q: Point, r: Point) => {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
};

// For the ordered points p, q, r, return
// 0 if p, q, r are colinear
// 1 if Clockwise
// 2 if counterclickwise
const orderedColinearOrientation = (p: Point, q: Point, r: Point) => {
  const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (val === 0) {
    return 0;
  }
  return val > 0 ? 1 : 2;
};

// Check is p1q1 intersects with p2q2
const doSegmentsIntersect = (p1: Point, q1: Point, p2: Point, q2: Point) => {
  const o1 = orderedColinearOrientation(p1, q1, p2);
  const o2 = orderedColinearOrientation(p1, q1, q2);
  const o3 = orderedColinearOrientation(p2, q2, p1);
  const o4 = orderedColinearOrientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  // p1, q1 and p2 are colinear and p2 lies on segment p1q1
  if (o1 === 0 && isPointWithinBounds(p1, p2, q1)) {
    return true;
  }

  // p1, q1 and p2 are colinear and q2 lies on segment p1q1
  if (o2 === 0 && isPointWithinBounds(p1, q2, q1)) {
    return true;
  }

  // p2, q2 and p1 are colinear and p1 lies on segment p2q2
  if (o3 === 0 && isPointWithinBounds(p2, p1, q2)) {
    return true;
  }

  // p2, q2 and q1 are colinear and q1 lies on segment p2q2
  if (o4 === 0 && isPointWithinBounds(p2, q1, q2)) {
    return true;
  }

  return false;
};

// TODO: Rounding this point causes some shake when free drawing
export const getGridPoint = (
  x: number,
  y: number,
  gridSize: number | null,
): [number, number] => {
  if (gridSize) {
    return [
      Math.round(x / gridSize) * gridSize,
      Math.round(y / gridSize) * gridSize,
    ];
  }
  return [x, y];
};

export const getCornerRadius = (x: number, element: ExcalidrawElement) => {
  if (
    element.roundness?.type === ROUNDNESS.PROPORTIONAL_RADIUS ||
    element.roundness?.type === ROUNDNESS.LEGACY
  ) {
    return x * DEFAULT_PROPORTIONAL_RADIUS;
  }

  if (element.roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS) {
    const fixedRadiusSize = element.roundness?.value ?? DEFAULT_ADAPTIVE_RADIUS;

    const CUTOFF_SIZE = fixedRadiusSize / DEFAULT_PROPORTIONAL_RADIUS;

    if (x <= CUTOFF_SIZE) {
      return x * DEFAULT_PROPORTIONAL_RADIUS;
    }

    return fixedRadiusSize;
  }

  return 0;
};

export const getControlPointsForBezierCurve = (
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: Point,
) => {
  const shape = ShapeCache.generateElementShape(element, null);
  if (!shape) {
    return null;
  }

  const ops = getCurvePathOps(shape[0]);
  let currentP: Mutable<Point> = [0, 0];
  let index = 0;
  let minDistance = Infinity;
  let controlPoints: Mutable<Point>[] | null = null;

  while (index < ops.length) {
    const { op, data } = ops[index];
    if (op === "move") {
      currentP = data as unknown as Mutable<Point>;
    }
    if (op === "bcurveTo") {
      const p0 = currentP;
      const p1 = [data[0], data[1]] as Mutable<Point>;
      const p2 = [data[2], data[3]] as Mutable<Point>;
      const p3 = [data[4], data[5]] as Mutable<Point>;
      const distance = distance2d(p3[0], p3[1], endPoint[0], endPoint[1]);
      if (distance < minDistance) {
        minDistance = distance;
        controlPoints = [p0, p1, p2, p3];
      }
      currentP = p3;
    }
    index++;
  }

  return controlPoints;
};

export const getBezierXY = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
) => {
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);
  const tx = equation(t, 0);
  const ty = equation(t, 1);
  return [tx, ty];
};

export const getPointsInBezierCurve = (
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: Point,
) => {
  const controlPoints: Mutable<Point>[] = getControlPointsForBezierCurve(
    element,
    endPoint,
  )!;
  if (!controlPoints) {
    return [];
  }
  const pointsOnCurve: Mutable<Point>[] = [];
  let t = 1;
  // Take 20 points on curve for better accuracy
  while (t > 0) {
    const point = getBezierXY(
      controlPoints[0],
      controlPoints[1],
      controlPoints[2],
      controlPoints[3],
      t,
    );
    pointsOnCurve.push([point[0], point[1]]);
    t -= 0.05;
  }
  if (pointsOnCurve.length) {
    if (arePointsEqual(pointsOnCurve.at(-1)!, endPoint)) {
      pointsOnCurve.push([endPoint[0], endPoint[1]]);
    }
  }
  return pointsOnCurve;
};

export const getBezierCurveArcLengths = (
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: Point,
) => {
  const arcLengths: number[] = [];
  arcLengths[0] = 0;
  const points = getPointsInBezierCurve(element, endPoint);
  let index = 0;
  let distance = 0;
  while (index < points.length - 1) {
    const segmentDistance = distance2d(
      points[index][0],
      points[index][1],
      points[index + 1][0],
      points[index + 1][1],
    );
    distance += segmentDistance;
    arcLengths.push(distance);
    index++;
  }

  return arcLengths;
};

export const getBezierCurveLength = (
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: Point,
) => {
  const arcLengths = getBezierCurveArcLengths(element, endPoint);
  return arcLengths.at(-1) as number;
};

// This maps interval to actual interval t on the curve so that when t = 0.5, its actually the point at 50% of the length
export const mapIntervalToBezierT = (
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: Point,
  interval: number, // The interval between 0 to 1 for which you want to find the point on the curve,
) => {
  const arcLengths = getBezierCurveArcLengths(element, endPoint);
  const pointsCount = arcLengths.length - 1;
  const curveLength = arcLengths.at(-1) as number;
  const targetLength = interval * curveLength;
  let low = 0;
  let high = pointsCount;
  let index = 0;
  // Doing a binary search to find the largest length that is less than the target length
  while (low < high) {
    index = Math.floor(low + (high - low) / 2);
    if (arcLengths[index] < targetLength) {
      low = index + 1;
    } else {
      high = index;
    }
  }
  if (arcLengths[index] > targetLength) {
    index--;
  }
  if (arcLengths[index] === targetLength) {
    return index / pointsCount;
  }

  return (
    1 -
    (index +
      (targetLength - arcLengths[index]) /
        (arcLengths[index + 1] - arcLengths[index])) /
      pointsCount
  );
};

export const arePointsEqual = (p1: Point, p2: Point) => {
  return p1[0] === p2[0] && p1[1] === p2[1];
};

export const isRightAngle = (angle: number) => {
  // if our angles were mathematically accurate, we could just check
  //
  //    angle % (Math.PI / 2) === 0
  //
  // but since we're in floating point land, we need to round.
  //
  // Below, after dividing by Math.PI, a multiple of 0.5 indicates a right
  // angle, which we can check with modulo after rounding.
  return Math.round((angle / Math.PI) * 10000) % 5000 === 0;
};

// Given two ranges, return if the two ranges overlap with each other
// e.g. [1, 3] overlaps with [2, 4] while [1, 3] does not overlap with [4, 5]
export const rangesOverlap = (
  [a0, a1]: [number, number],
  [b0, b1]: [number, number],
) => {
  if (a0 <= b0) {
    return a1 >= b0;
  }

  if (a0 >= b0) {
    return b1 >= a0;
  }

  return false;
};

// Given two ranges,return ther intersection of the two ranges if any
// e.g. the intersection of [1, 3] and [2, 4] is [2, 3]
export const rangeIntersection = (
  rangeA: [number, number],
  rangeB: [number, number],
): [number, number] | null => {
  const rangeStart = Math.max(rangeA[0], rangeB[0]);
  const rangeEnd = Math.min(rangeA[1], rangeB[1]);

  if (rangeStart <= rangeEnd) {
    return [rangeStart, rangeEnd];
  }

  return null;
};

export const isValueInRange = (value: number, min: number, max: number) => {
  return value >= min && value <= max;
};
