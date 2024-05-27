import { distance2d } from "../../excalidraw/math";
import type {
  Point,
  Line,
  Polygon,
  Curve,
  Ellipse,
  Polycurve,
  Polyline,
} from "./shape";

const DEFAULT_THRESHOLD = 10e-5;

/**
 * utils
 */

// the two vectors are ao and bo
export const cross = (a: Point, b: Point, o: Point) => {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
};

export const isClosed = (polygon: Polygon) => {
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  return first[0] === last[0] && first[1] === last[1];
};

export const close = (polygon: Polygon) => {
  return isClosed(polygon) ? polygon : [...polygon, polygon[0]];
};

/**
 * angles
 */

// convert radians to degress
export const angleToDegrees = (angle: number) => {
  return (angle * 180) / Math.PI;
};

// convert degrees to radians
export const angleToRadians = (angle: number) => {
  return (angle / 180) * Math.PI;
};

// return the angle of reflection given an angle of incidence and a surface angle in degrees
export const angleReflect = (incidenceAngle: number, surfaceAngle: number) => {
  const a = surfaceAngle * 2 - incidenceAngle;
  return a >= 360 ? a - 360 : a < 0 ? a + 360 : a;
};

/**
 * points
 */

const rotate = (point: Point, angle: number): Point => {
  return [
    point[0] * Math.cos(angle) - point[1] * Math.sin(angle),
    point[0] * Math.sin(angle) + point[1] * Math.cos(angle),
  ];
};

const isOrigin = (point: Point) => {
  return point[0] === 0 && point[1] === 0;
};

// rotate a given point about a given origin at the given angle
export const pointRotate = (
  point: Point,
  angle: number,
  origin?: Point,
): Point => {
  const r = angleToRadians(angle);

  if (!origin || isOrigin(origin)) {
    return rotate(point, r);
  }
  return rotate(point.map((c, i) => c - origin[i]) as Point, r).map(
    (c, i) => c + origin[i],
  ) as Point;
};

// translate a point by an angle (in degrees) and distance
export const pointTranslate = (point: Point, angle = 0, distance = 0) => {
  const r = angleToRadians(angle);
  return [
    point[0] + distance * Math.cos(r),
    point[1] + distance * Math.sin(r),
  ] as Point;
};

export const pointInverse = (point: Point) => {
  return [-point[0], -point[1]] as Point;
};

export const pointAdd = (pointA: Point, pointB: Point): Point => {
  return [pointA[0] + pointB[0], pointA[1] + pointB[1]];
};

export const distanceToPoint = (p1: Point, p2: Point) => {
  return distance2d(...p1, ...p2);
};

/**
 * lines
 */

// return the angle of a line, in degrees
export const lineAngle = (line: Line) => {
  return angleToDegrees(
    Math.atan2(line[1][1] - line[0][1], line[1][0] - line[0][0]),
  );
};

// get the distance between the endpoints of a line segment
export const lineLength = (line: Line) => {
  return Math.sqrt(
    Math.pow(line[1][0] - line[0][0], 2) + Math.pow(line[1][1] - line[0][1], 2),
  );
};

// get the midpoint of a line segment
export const lineMidpoint = (line: Line) => {
  return [
    (line[0][0] + line[1][0]) / 2,
    (line[0][1] + line[1][1]) / 2,
  ] as Point;
};

// return the coordinates resulting from rotating the given line about an origin by an angle in degrees
// note that when the origin is not given, the midpoint of the given line is used as the origin
export const lineRotate = (line: Line, angle: number, origin?: Point): Line => {
  return line.map((point) =>
    pointRotate(point, angle, origin || lineMidpoint(line)),
  ) as Line;
};

// returns the coordinates resulting from translating a line by an angle in degrees and a distance.
export const lineTranslate = (line: Line, angle: number, distance: number) => {
  return line.map((point) => pointTranslate(point, angle, distance));
};

export const lineInterpolate = (line: Line, clamp = false) => {
  const [[x1, y1], [x2, y2]] = line;
  return (t: number) => {
    const t0 = clamp ? (t < 0 ? 0 : t > 1 ? 1 : t) : t;
    return [(x2 - x1) * t0 + x1, (y2 - y1) * t0 + y1] as Point;
  };
};

/**
 * curves
 */
function clone(p: Point): Point {
  return [...p] as Point;
}

export const curveToBezier = (
  pointsIn: readonly Point[],
  curveTightness = 0,
): Point[] => {
  const len = pointsIn.length;
  if (len < 3) {
    throw new Error("A curve must have at least three points.");
  }
  const out: Point[] = [];
  if (len === 3) {
    out.push(
      clone(pointsIn[0]),
      clone(pointsIn[1]),
      clone(pointsIn[2]),
      clone(pointsIn[2]),
    );
  } else {
    const points: Point[] = [];
    points.push(pointsIn[0], pointsIn[0]);
    for (let i = 1; i < pointsIn.length; i++) {
      points.push(pointsIn[i]);
      if (i === pointsIn.length - 1) {
        points.push(pointsIn[i]);
      }
    }
    const b: Point[] = [];
    const s = 1 - curveTightness;
    out.push(clone(points[0]));
    for (let i = 1; i + 2 < points.length; i++) {
      const cachedVertArray = points[i];
      b[0] = [cachedVertArray[0], cachedVertArray[1]];
      b[1] = [
        cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6,
        cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6,
      ];
      b[2] = [
        points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6,
        points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6,
      ];
      b[3] = [points[i + 1][0], points[i + 1][1]];
      out.push(b[1], b[2], b[3]);
    }
  }
  return out;
};

export const curveRotate = (curve: Curve, angle: number, origin: Point) => {
  return curve.map((p) => pointRotate(p, angle, origin));
};

export const cubicBezierPoint = (t: number, controlPoints: Curve): Point => {
  const [p0, p1, p2, p3] = controlPoints;

  const x =
    Math.pow(1 - t, 3) * p0[0] +
    3 * Math.pow(1 - t, 2) * t * p1[0] +
    3 * (1 - t) * Math.pow(t, 2) * p2[0] +
    Math.pow(t, 3) * p3[0];

  const y =
    Math.pow(1 - t, 3) * p0[1] +
    3 * Math.pow(1 - t, 2) * t * p1[1] +
    3 * (1 - t) * Math.pow(t, 2) * p2[1] +
    Math.pow(t, 3) * p3[1];

  return [x, y];
};

const solveCubicEquation = (a: number, b: number, c: number, d: number) => {
  // This function solves the cubic equation ax^3 + bx^2 + cx + d = 0
  const roots: number[] = [];

  const discriminant =
    18 * a * b * c * d -
    4 * Math.pow(b, 3) * d +
    Math.pow(b, 2) * Math.pow(c, 2) -
    4 * a * Math.pow(c, 3) -
    27 * Math.pow(a, 2) * Math.pow(d, 2);

  if (discriminant >= 0) {
    const C = Math.cbrt((discriminant + Math.sqrt(discriminant)) / 2);
    const D = Math.cbrt((discriminant - Math.sqrt(discriminant)) / 2);

    const root1 = (-b - C - D) / (3 * a);
    const root2 = (-b + (C + D) / 2) / (3 * a);
    const root3 = (-b + (C + D) / 2) / (3 * a);

    roots.push(root1, root2, root3);
  } else {
    const realPart = -b / (3 * a);

    const root1 =
      2 * Math.sqrt(-b / (3 * a)) * Math.cos(Math.acos(realPart) / 3);
    const root2 =
      2 *
      Math.sqrt(-b / (3 * a)) *
      Math.cos((Math.acos(realPart) + 2 * Math.PI) / 3);
    const root3 =
      2 *
      Math.sqrt(-b / (3 * a)) *
      Math.cos((Math.acos(realPart) + 4 * Math.PI) / 3);

    roots.push(root1, root2, root3);
  }

  return roots;
};

const findClosestParameter = (point: Point, controlPoints: Curve) => {
  // This function finds the parameter t that minimizes the distance between the point
  // and any point on the cubic Bezier curve.

  const [p0, p1, p2, p3] = controlPoints;

  // Use the direct formula to find the parameter t
  const a = p3[0] - 3 * p2[0] + 3 * p1[0] - p0[0];
  const b = 3 * p2[0] - 6 * p1[0] + 3 * p0[0];
  const c = 3 * p1[0] - 3 * p0[0];
  const d = p0[0] - point[0];

  const rootsX = solveCubicEquation(a, b, c, d);

  // Do the same for the y-coordinate
  const e = p3[1] - 3 * p2[1] + 3 * p1[1] - p0[1];
  const f = 3 * p2[1] - 6 * p1[1] + 3 * p0[1];
  const g = 3 * p1[1] - 3 * p0[1];
  const h = p0[1] - point[1];

  const rootsY = solveCubicEquation(e, f, g, h);

  // Select the real root that is between 0 and 1 (inclusive)
  const validRootsX = rootsX.filter((root) => root >= 0 && root <= 1);
  const validRootsY = rootsY.filter((root) => root >= 0 && root <= 1);

  if (validRootsX.length === 0 || validRootsY.length === 0) {
    // No valid roots found, use the midpoint as a fallback
    return 0.5;
  }

  // Choose the parameter t that minimizes the distance
  let minDistance = Infinity;
  let closestT = 0;

  for (const rootX of validRootsX) {
    for (const rootY of validRootsY) {
      const distance = Math.sqrt(
        (rootX - point[0]) ** 2 + (rootY - point[1]) ** 2,
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestT = (rootX + rootY) / 2; // Use the average for a smoother result
      }
    }
  }

  return closestT;
};

export const cubicBezierDistance = (point: Point, controlPoints: Curve) => {
  // Calculate the closest point on the Bezier curve to the given point
  const t = findClosestParameter(point, controlPoints);

  // Calculate the coordinates of the closest point on the curve
  const [closestX, closestY] = cubicBezierPoint(t, controlPoints);

  // Calculate the distance between the given point and the closest point on the curve
  const distance = Math.sqrt(
    (point[0] - closestX) ** 2 + (point[1] - closestY) ** 2,
  );

  return distance;
};

/**
 * polygons
 */

export const polygonRotate = (
  polygon: Polygon,
  angle: number,
  origin: Point,
) => {
  return polygon.map((p) => pointRotate(p, angle, origin));
};

export const polygonBounds = (polygon: Polygon) => {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (let i = 0, l = polygon.length; i < l; i++) {
    const p = polygon[i];
    const x = p[0];
    const y = p[1];

    if (x != null && isFinite(x) && y != null && isFinite(y)) {
      if (x < xMin) {
        xMin = x;
      }
      if (x > xMax) {
        xMax = x;
      }
      if (y < yMin) {
        yMin = y;
      }
      if (y > yMax) {
        yMax = y;
      }
    }
  }

  return [
    [xMin, yMin],
    [xMax, yMax],
  ] as [Point, Point];
};

export const polygonCentroid = (vertices: Point[]) => {
  let a = 0;
  let x = 0;
  let y = 0;
  const l = vertices.length;

  for (let i = 0; i < l; i++) {
    const s = i === l - 1 ? 0 : i + 1;
    const v0 = vertices[i];
    const v1 = vertices[s];
    const f = v0[0] * v1[1] - v1[0] * v0[1];

    a += f;
    x += (v0[0] + v1[0]) * f;
    y += (v0[1] + v1[1]) * f;
  }

  const d = a * 3;

  return [x / d, y / d] as Point;
};

export const polygonScale = (
  polygon: Polygon,
  scale: number,
  origin?: Point,
) => {
  if (!origin) {
    origin = polygonCentroid(polygon);
  }

  const p: Polygon = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const v = polygon[i];
    const d = lineLength([origin, v]);
    const a = lineAngle([origin, v]);

    p[i] = pointTranslate(origin, a, d * scale);
  }

  return p;
};

export const polygonScaleX = (
  polygon: Polygon,
  scale: number,
  origin?: Point,
) => {
  if (!origin) {
    origin = polygonCentroid(polygon);
  }

  const p: Polygon = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const v = polygon[i];
    const d = lineLength([origin, v]);
    const a = lineAngle([origin, v]);
    const t = pointTranslate(origin, a, d * scale);

    p[i] = [t[0], v[1]];
  }

  return p;
};

export const polygonScaleY = (
  polygon: Polygon,
  scale: number,
  origin?: Point,
) => {
  if (!origin) {
    origin = polygonCentroid(polygon);
  }

  const p: Polygon = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const v = polygon[i];
    const d = lineLength([origin, v]);
    const a = lineAngle([origin, v]);
    const t = pointTranslate(origin, a, d * scale);

    p[i] = [v[0], t[1]];
  }

  return p;
};

export const polygonReflectX = (polygon: Polygon, reflectFactor = 1) => {
  const [[min], [max]] = polygonBounds(polygon);
  const p: Point[] = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const [x, y] = polygon[i];
    const r: Point = [min + max - x, y];

    if (reflectFactor === 0) {
      p[i] = [x, y];
    } else if (reflectFactor === 1) {
      p[i] = r;
    } else {
      const t = lineInterpolate([[x, y], r]);
      p[i] = t(Math.max(Math.min(reflectFactor, 1), 0));
    }
  }

  return p;
};

export const polygonReflectY = (polygon: Polygon, reflectFactor = 1) => {
  const [[, min], [, max]] = polygonBounds(polygon);
  const p: Point[] = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const [x, y] = polygon[i];
    const r: Point = [x, min + max - y];

    if (reflectFactor === 0) {
      p[i] = [x, y];
    } else if (reflectFactor === 1) {
      p[i] = r;
    } else {
      const t = lineInterpolate([[x, y], r]);
      p[i] = t(Math.max(Math.min(reflectFactor, 1), 0));
    }
  }

  return p;
};

export const polygonTranslate = (
  polygon: Polygon,
  angle: number,
  distance: number,
) => {
  return polygon.map((p) => pointTranslate(p, angle, distance));
};

/**
 * ellipses
 */

export const ellipseAxes = (ellipse: Ellipse) => {
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

export const ellipseFocusToCenter = (ellipse: Ellipse) => {
  const { majorAxis, minorAxis } = ellipseAxes(ellipse);

  return Math.sqrt(majorAxis ** 2 - minorAxis ** 2);
};

export const ellipseExtremes = (ellipse: Ellipse) => {
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

  return [
    pointAdd([xAtYMax, yMax], center),
    pointAdd(pointInverse([xAtYMax, yMax]), center),
    pointAdd([xMax, yAtXMax], center),
    pointAdd([xMax, yAtXMax], center),
  ];
};

export const pointRelativeToCenter = (
  point: Point,
  center: Point,
  angle: number,
): Point => {
  const translated = pointAdd(point, pointInverse(center));
  const rotated = pointRotate(translated, -angleToDegrees(angle));

  return rotated;
};

/**
 * relationships
 */

const topPointFirst = (line: Line) => {
  return line[1][1] > line[0][1] ? line : [line[1], line[0]];
};

export const pointLeftofLine = (point: Point, line: Line) => {
  const t = topPointFirst(line);
  return cross(point, t[1], t[0]) < 0;
};

export const pointRightofLine = (point: Point, line: Line) => {
  const t = topPointFirst(line);
  return cross(point, t[1], t[0]) > 0;
};

export const distanceToSegment = (point: Point, line: Line) => {
  const [x, y] = point;
  const [[x1, y1], [x2, y2]] = line;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) {
    param = dot / len_sq;
  }

  let xx;
  let yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const pointOnLine = (
  point: Point,
  line: Line,
  threshold = DEFAULT_THRESHOLD,
) => {
  const distance = distanceToSegment(point, line);

  if (distance === 0) {
    return true;
  }

  return distance < threshold;
};

export const pointOnPolyline = (
  point: Point,
  polyline: Polyline,
  threshold = DEFAULT_THRESHOLD,
) => {
  return polyline.some((line) => pointOnLine(point, line, threshold));
};

export const lineIntersectsLine = (lineA: Line, lineB: Line) => {
  const [[a0x, a0y], [a1x, a1y]] = lineA;
  const [[b0x, b0y], [b1x, b1y]] = lineB;

  // shared points
  if (a0x === b0x && a0y === b0y) {
    return true;
  }
  if (a1x === b1x && a1y === b1y) {
    return true;
  }

  // point on line
  if (pointOnLine(lineA[0], lineB) || pointOnLine(lineA[1], lineB)) {
    return true;
  }
  if (pointOnLine(lineB[0], lineA) || pointOnLine(lineB[1], lineA)) {
    return true;
  }

  const denom = (b1y - b0y) * (a1x - a0x) - (b1x - b0x) * (a1y - a0y);

  if (denom === 0) {
    return false;
  }

  const deltaY = a0y - b0y;
  const deltaX = a0x - b0x;
  const numer0 = (b1x - b0x) * deltaY - (b1y - b0y) * deltaX;
  const numer1 = (a1x - a0x) * deltaY - (a1y - a0y) * deltaX;
  const quotA = numer0 / denom;
  const quotB = numer1 / denom;

  return quotA > 0 && quotA < 1 && quotB > 0 && quotB < 1;
};

export const lineIntersectsPolygon = (line: Line, polygon: Polygon) => {
  let intersects = false;
  const closed = close(polygon);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    const v0 = closed[i];
    const v1 = closed[i + 1];

    if (
      lineIntersectsLine(line, [v0, v1]) ||
      (pointOnLine(v0, line) && pointOnLine(v1, line))
    ) {
      intersects = true;
      break;
    }
  }

  return intersects;
};

export const pointInBezierEquation = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  [mx, my]: Point,
  lineThreshold: number,
) => {
  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  const lineSegmentPoints: Point[] = [];
  let t = 0;
  while (t <= 1.0) {
    const tx = equation(t, 0);
    const ty = equation(t, 1);

    const diff = Math.sqrt(Math.pow(tx - mx, 2) + Math.pow(ty - my, 2));

    if (diff < lineThreshold) {
      return true;
    }

    lineSegmentPoints.push([tx, ty]);

    t += 0.1;
  }

  // check the distance from line segments to the given point

  return false;
};

export const cubicBezierEquation = (curve: Curve) => {
  const [p0, p1, p2, p3] = curve;
  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  return (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);
};

export const polyLineFromCurve = (curve: Curve, segments = 10): Polyline => {
  const equation = cubicBezierEquation(curve);
  let startingPoint = [equation(0, 0), equation(0, 1)] as Point;
  const lineSegments: Polyline = [];
  let t = 0;
  const increment = 1 / segments;

  for (let i = 0; i < segments; i++) {
    t += increment;
    if (t <= 1) {
      const nextPoint: Point = [equation(t, 0), equation(t, 1)];
      lineSegments.push([startingPoint, nextPoint]);
      startingPoint = nextPoint;
    }
  }

  return lineSegments;
};

export const pointOnCurve = (
  point: Point,
  curve: Curve,
  threshold = DEFAULT_THRESHOLD,
) => {
  return pointOnPolyline(point, polyLineFromCurve(curve), threshold);
};

export const pointOnPolycurve = (
  point: Point,
  polycurve: Polycurve,
  threshold = DEFAULT_THRESHOLD,
) => {
  return polycurve.some((curve) => pointOnCurve(point, curve, threshold));
};

export const pointInPolygon = (point: Point, polygon: Polygon) => {
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    if (
      ((yi > y && yj <= y) || (yi <= y && yj > y)) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
};

export const pointOnPolygon = (
  point: Point,
  polygon: Polygon,
  threshold = DEFAULT_THRESHOLD,
) => {
  let on = false;
  const closed = close(polygon);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    if (pointOnLine(point, [closed[i], closed[i + 1]], threshold)) {
      on = true;
      break;
    }
  }

  return on;
};

export const polygonInPolygon = (polygonA: Polygon, polygonB: Polygon) => {
  let inside = true;
  const closed = close(polygonA);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    const v0 = closed[i];

    // Points test
    if (!pointInPolygon(v0, polygonB)) {
      inside = false;
      break;
    }

    // Lines test
    if (lineIntersectsPolygon([v0, closed[i + 1]], polygonB)) {
      inside = false;
      break;
    }
  }

  return inside;
};

export const polygonIntersectPolygon = (
  polygonA: Polygon,
  polygonB: Polygon,
) => {
  let intersects = false;
  let onCount = 0;
  const closed = close(polygonA);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    const v0 = closed[i];
    const v1 = closed[i + 1];

    if (lineIntersectsPolygon([v0, v1], polygonB)) {
      intersects = true;
      break;
    }

    if (pointOnPolygon(v0, polygonB)) {
      ++onCount;
    }

    if (onCount === 2) {
      intersects = true;
      break;
    }
  }

  return intersects;
};

const distanceToEllipse = (point: Point, ellipse: Ellipse) => {
  const { angle, halfWidth, halfHeight, center } = ellipse;
  const a = halfWidth;
  const b = halfHeight;
  const [rotatedPointX, rotatedPointY] = pointRelativeToCenter(
    point,
    center,
    angle,
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

  return distanceToPoint([rotatedPointX, rotatedPointY], [minX, minY]);
};

export const pointOnEllipse = (
  point: Point,
  ellipse: Ellipse,
  threshold = DEFAULT_THRESHOLD,
) => {
  return distanceToEllipse(point, ellipse) <= threshold;
};

export const pointInEllipse = (point: Point, ellipse: Ellipse) => {
  const { center, angle, halfWidth, halfHeight } = ellipse;
  const [rotatedPointX, rotatedPointY] = pointRelativeToCenter(
    point,
    center,
    angle,
  );

  return (
    (rotatedPointX / halfWidth) * (rotatedPointX / halfWidth) +
      (rotatedPointY / halfHeight) * (rotatedPointY / halfHeight) <=
    1
  );
};
