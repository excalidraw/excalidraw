import type {
  Curve,
  Line,
  LineSegment,
  Polygon,
  Radians,
} from "@excalidraw/math";
import {
  point,
  pointRotateRads,
  vectorCross,
  type GlobalPoint,
  type LocalPoint,
  lineSegment,
  vectorSubtract,
  vectorFromPoint,
  vectorScale,
  vectorAdd,
  pointFromVector,
  pointDistance,
  line,
  pointCenter,
  pointTranslate,
  vector,
  polygonIsClosed,
  polygonFromPoints,
} from "@excalidraw/math";
import type { ExcalidrawBindableElement } from "../../excalidraw/element/types";
import type { Ellipse, Polycurve, Polyline } from "./shape";

const DEFAULT_THRESHOLD = 10e-5;

/**
 * utils
 */

// // the two vectors are ao and bo
// export const cross = (
//   a: Readonly<Point>,
//   b: Readonly<Point>,
//   o: Readonly<Point>,
// ) => {
//   return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
// };

// export const dot = (
//   a: Readonly<Point>,
//   b: Readonly<Point>,
//   o: Readonly<Point>,
// ) => {
//   return (a[0] - o[0]) * (b[0] - o[0]) + (a[1] - o[1]) * (b[1] - o[1]);
// };

export const closePolygon = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
) => {
  return polygonIsClosed(polygon) ? polygon : [...polygon, polygon[0]];
};

/**
 * angles
 */

// // convert radians to degress
// export const angleToDegrees = (angle: number) => {
//   const theta = (angle * 180) / Math.PI;

//   return theta < 0 ? 360 + theta : theta;
// };

// // convert degrees to radians
// export const angleToRadians = (angle: number) => {
//   return (angle / 180) * Math.PI;
// };

// return the angle of reflection given an angle of incidence and a surface angle in degrees
export const angleReflect = (incidenceAngle: number, surfaceAngle: number) => {
  const a = surfaceAngle * 2 - incidenceAngle;
  return a >= 360 ? a - 360 : a < 0 ? a + 360 : a;
};

/**
 * points
 */

// const rotate = (point: Point, angle: number): Point => {
//   return [
//     point[0] * Math.cos(angle) - point[1] * Math.sin(angle),
//     point[0] * Math.sin(angle) + point[1] * Math.cos(angle),
//   ];
// };

// const isOrigin = (point: Point) => {
//   return point[0] === 0 && point[1] === 0;
// };

// rotate a given point about a given origin at the given angle
// export const pointRotate = (
//   point: Point,
//   angle: number,
//   origin?: Point,
// ): Point => {
//   const r = angleToRadians(angle);

//   if (!origin || isOrigin(origin)) {
//     return rotate(point, r);
//   }
//   return rotate(point.map((c, i) => c - origin[i]) as Point, r).map(
//     (c, i) => c + origin[i],
//   ) as Point;
// };

// // translate a point by an angle (in degrees) and distance
// export const pointTranslate = (point: Point, angle = 0, distance = 0) => {
//   const r = angleToRadians(angle);
//   return [
//     point[0] + distance * Math.cos(r),
//     point[1] + distance * Math.sin(r),
//   ] as Point;
// };

export const pointInverse = <Point extends LocalPoint | GlobalPoint>(
  p: Point,
): Point => {
  return point(-p[0], -p[1]);
};

export const pointAdd = <Point extends LocalPoint | GlobalPoint>(
  pointA: Point,
  pointB: Point,
): Point => {
  return point(pointA[0] + pointB[0], pointA[1] + pointB[1]);
};

export const distanceToPoint = <Point extends LocalPoint | GlobalPoint>(
  p1: Point,
  p2: Point,
) => {
  return pointDistance(p1, p2);
};

/**
 * lines
 */

// return the angle of a line, in degrees
export const lineAngle = <Point extends LocalPoint | GlobalPoint>(
  line: Line<Point>,
): Radians => {
  return Math.atan2(
    line[1][1] - line[0][1],
    line[1][0] - line[0][0],
  ) as Radians;
};

// get the distance between the endpoints of a line segment
export const lineLength = <Point extends LocalPoint | GlobalPoint>(
  line: Line<Point>,
) => {
  return Math.sqrt(
    Math.pow(line[1][0] - line[0][0], 2) + Math.pow(line[1][1] - line[0][1], 2),
  );
};

// // get the midpoint of a line segment
// export const lineMidpoint = <Point extends LocalPoint | GlobalPoint>(
//   line: Line<Point>,
// ) => {
//   return point((line[0][0] + line[1][0]) / 2, (line[0][1] + line[1][1]) / 2);
// };

// return the coordinates resulting from rotating the given line about an origin by an angle in degrees
// note that when the origin is not given, the midpoint of the given line is used as the origin
export const lineRotate = <Point extends LocalPoint | GlobalPoint>(
  l: Line<Point>,
  angle: Radians,
  origin?: Point,
): Line<Point> => {
  return line(
    pointRotateRads(l[0], origin || pointCenter(l[0], l[1]), angle),
    pointRotateRads(l[1], origin || pointCenter(l[0], l[1]), angle),
  );
};

// returns the coordinates resulting from translating a line by an angle in degrees and a distance.
export const lineTranslate = <Point extends LocalPoint | GlobalPoint>(
  line: Line<Point>,
  angle: Radians,
  distance: number,
) => {
  return line.map((p) =>
    pointTranslate(
      pointRotateRads(p, point(0, 0), angle),
      vector(distance, distance),
    ),
  ); //(p, angle, distance));
};

export const lineInterpolate = <Point extends LocalPoint | GlobalPoint>(
  line: Line<Point>,
  clamp = false,
) => {
  const [[x1, y1], [x2, y2]] = line;
  return <P extends GlobalPoint | LocalPoint>(t: number) => {
    const t0 = clamp ? (t < 0 ? 0 : t > 1 ? 1 : t) : t;
    return point<P>((x2 - x1) * t0 + x1, (y2 - y1) * t0 + y1);
  };
};

/**
 * curves
 */
function clone<Point extends LocalPoint | GlobalPoint>(p: Point): Point {
  return [...p] as Point;
}

export const curveToBezier = <Point extends LocalPoint | GlobalPoint>(
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
      b[0] = point(cachedVertArray[0], cachedVertArray[1]);
      b[1] = point(
        cachedVertArray[0] + (s * points[i + 1][0] - s * points[i - 1][0]) / 6,
        cachedVertArray[1] + (s * points[i + 1][1] - s * points[i - 1][1]) / 6,
      );
      b[2] = point(
        points[i + 1][0] + (s * points[i][0] - s * points[i + 2][0]) / 6,
        points[i + 1][1] + (s * points[i][1] - s * points[i + 2][1]) / 6,
      );
      b[3] = point(points[i + 1][0], points[i + 1][1]);
      out.push(b[1], b[2], b[3]);
    }
  }
  return out;
};

export const curveRotate = <Point extends LocalPoint | GlobalPoint>(
  curve: Curve<Point>,
  angle: Radians,
  origin: Point,
) => {
  return curve.map((p) => pointRotateRads(p, origin, angle));
};

export const cubicBezierPoint = <Point extends LocalPoint | GlobalPoint>(
  t: number,
  controlPoints: Curve<Point>,
): Point => {
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

  return point(x, y);
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

const findClosestParameter = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  controlPoints: Curve<Point>,
) => {
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

export const cubicBezierDistance = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  controlPoints: Curve<Point>,
) => {
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

export const polygonRotate = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
  angle: Radians,
  origin: Point,
) => {
  return polygon.map((p) => pointRotateRads(p, origin, angle));
};

export const polygonBounds = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
) => {
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
  ];
};

export const polygonCentroid = <Point extends LocalPoint | GlobalPoint>(
  vertices: Point[],
) => {
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

export const polygonScale = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
  scale: number,
  origin?: Point,
): Polygon<Point> => {
  if (!origin) {
    origin = polygonCentroid(polygon);
  }

  const p: Point[] = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const v = polygon[i];
    const d = lineLength(line(origin, v));
    const a = lineAngle(line(origin, v));
    p[i] = pointTranslate(
      pointRotateRads(origin, point(0, 0), a as Radians),
      vector(d * scale, d * scale),
    );
  }

  return polygonFromPoints(p);
};

export const polygonScaleX = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
  scale: number,
  origin?: Point,
) => {
  if (!origin) {
    origin = polygonCentroid(polygon);
  }

  const p: Point[] = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const v = polygon[i];
    const d = lineLength(line(origin, v));
    const a = lineAngle(line(origin, v));
    const t = pointTranslate(
      pointRotateRads(origin, point(0, 0), a),
      vector(d * scale, d * scale),
    );

    p[i] = point(t[0], v[1]);
  }

  return polygonFromPoints(p);
};

export const polygonScaleY = <Point extends LocalPoint | GlobalPoint>(
  poly: Polygon<Point>,
  scale: number,
  origin?: Point,
) => {
  if (!origin) {
    origin = polygonCentroid(poly);
  }

  const p: Point[] = [];

  for (let i = 0, l = poly.length; i < l; i++) {
    const v = poly[i];
    const d = lineLength(line(origin, v));
    const a = lineAngle(line(origin, v));
    const t = pointTranslate(
      pointRotateRads(origin, point(0, 0), a),
      vector(d * scale, d * scale),
    );

    p[i] = point(v[0], t[1]);
  }

  return polygonFromPoints<Point>(p);
};

export const polygonReflectX = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
  reflectFactor = 1,
) => {
  const [[min], [max]] = polygonBounds(polygon);
  const p: Point[] = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const [x, y] = polygon[i];
    const r: Point = point(min + max - x, y);

    if (reflectFactor === 0) {
      p[i] = point(x, y);
    } else if (reflectFactor === 1) {
      p[i] = r;
    } else {
      const t = lineInterpolate(line(point(x, y), r));
      p[i] = t(Math.max(Math.min(reflectFactor, 1), 0));
    }
  }

  return p;
};

export const polygonReflectY = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
  reflectFactor = 1,
): Point[] => {
  const [[, min], [, max]] = polygonBounds(polygon);
  const p: Point[] = [];

  for (let i = 0, l = polygon.length; i < l; i++) {
    const [x, y] = polygon[i];
    const r: Point = point(x, min + max - y);

    if (reflectFactor === 0) {
      p[i] = point(x, y);
    } else if (reflectFactor === 1) {
      p[i] = r;
    } else {
      const t = lineInterpolate(line(point(x, y), r));
      p[i] = t<Point>(Math.max(Math.min(reflectFactor, 1), 0));
    }
  }

  return p;
};

export const polygonTranslate = <Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
  angle: number,
  distance: number,
) => {
  return polygon.map((p) =>
    pointTranslate(
      pointRotateRads(p, point(0, 0), angle as Radians),
      vector(distance, distance),
    ),
  );
};

/**
 * ellipses
 */

export const ellipseAxes = <Point extends LocalPoint | GlobalPoint>(
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

export const ellipseFocusToCenter = <Point extends LocalPoint | GlobalPoint>(
  ellipse: Ellipse<Point>,
) => {
  const { majorAxis, minorAxis } = ellipseAxes(ellipse);

  return Math.sqrt(majorAxis ** 2 - minorAxis ** 2);
};

export const ellipseExtremes = <Point extends LocalPoint | GlobalPoint>(
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

  return [
    pointAdd(point(xAtYMax, yMax), center),
    pointAdd(pointInverse(point(xAtYMax, yMax)), center),
    pointAdd(point(xMax, yAtXMax), center),
    pointAdd(point(xMax, yAtXMax), center),
  ];
};

export const pointRelativeToCenter = <Point extends LocalPoint | GlobalPoint>(
  p: Point,
  center: Point,
  angle: Radians,
): Point => {
  const translated = pointAdd<Point>(p, pointInverse<Point>(center));

  return pointRotateRads(translated, point(0, 0), -angle as Radians);
};

/**
 * relationships
 */

const topPointFirst = <Point extends LocalPoint | GlobalPoint>(
  line: Line<Point>,
) => {
  return line[1][1] > line[0][1] ? line : [line[1], line[0]];
};

export const pointLeftofLine = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: Line<Point>,
) => {
  const t = topPointFirst(line);
  return (
    vectorCross(vectorFromPoint(point, t[0]), vectorFromPoint(t[1], t[0])) < 0
  );
};

export const pointRightofLine = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: Line<Point>,
) => {
  const t = topPointFirst(line);
  return (
    vectorCross(vectorFromPoint(point, t[0]), vectorFromPoint(t[1], t[0])) > 0
  );
};

export const distanceToLineSegment = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: LineSegment<Point>,
) => {
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

export const pointOnLineSegment = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: LineSegment<Point>,
  threshold = DEFAULT_THRESHOLD,
) => {
  const distance = distanceToLineSegment(point, line);

  if (distance === 0) {
    return true;
  }

  return distance < threshold;
};

export const pointOnPolyline = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  polyline: Polyline<Point>,
  threshold = DEFAULT_THRESHOLD,
) => {
  return polyline.some((line) => pointOnLineSegment(point, line, threshold));
};

export const lineIntersectsLine = <Point extends LocalPoint | GlobalPoint>(
  lineA: LineSegment<Point>,
  lineB: LineSegment<Point>,
) => {
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
  if (
    pointOnLineSegment(lineA[0], lineB) ||
    pointOnLineSegment(lineA[1], lineB)
  ) {
    return true;
  }
  if (
    pointOnLineSegment(lineB[0], lineA) ||
    pointOnLineSegment(lineB[1], lineA)
  ) {
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

export const lineIntersectsPolygon = <Point extends LocalPoint | GlobalPoint>(
  line: LineSegment<Point>,
  polygon: Polygon<Point>,
) => {
  let intersects = false;
  const closed = closePolygon(polygon);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    const v0 = closed[i];
    const v1 = closed[i + 1];

    if (
      lineIntersectsLine(line, lineSegment(v0, v1)) ||
      (pointOnLineSegment(v0, line) && pointOnLineSegment(v1, line))
    ) {
      intersects = true;
      break;
    }
  }

  return intersects;
};

export const pointInBezierEquation = <Point extends LocalPoint | GlobalPoint>(
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

    lineSegmentPoints.push(point(tx, ty));

    t += 0.1;
  }

  // check the distance from line segments to the given point

  return false;
};

export const cubicBezierEquation = <Point extends LocalPoint | GlobalPoint>(
  curve: Curve<Point>,
) => {
  const [p0, p1, p2, p3] = curve;
  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  return (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);
};

export const polyLineFromCurve = <Point extends LocalPoint | GlobalPoint>(
  curve: Curve<Point>,
  segments = 10,
): Polyline<Point> => {
  const equation = cubicBezierEquation(curve);
  let startingPoint = [equation(0, 0), equation(0, 1)] as Point;
  const lineSegments: Polyline<Point> = [];
  let t = 0;
  const increment = 1 / segments;

  for (let i = 0; i < segments; i++) {
    t += increment;
    if (t <= 1) {
      const nextPoint: Point = point(equation(t, 0), equation(t, 1));
      lineSegments.push(lineSegment(startingPoint, nextPoint));
      startingPoint = nextPoint;
    }
  }

  return lineSegments;
};

export const pointOnCurve = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  curve: Curve<Point>,
  threshold = DEFAULT_THRESHOLD,
) => {
  return pointOnPolyline(point, polyLineFromCurve(curve), threshold);
};

export const pointOnPolycurve = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  polycurve: Polycurve<Point>,
  threshold = DEFAULT_THRESHOLD,
) => {
  return polycurve.some((curve) => pointOnCurve(point, curve, threshold));
};

export const pointInPolygon = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  polygon: Polygon<Point>,
) => {
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

export const pointOnPolygon = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  polygon: Polygon<Point>,
  threshold = DEFAULT_THRESHOLD,
) => {
  let on = false;
  const closed = closePolygon(polygon);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    if (
      pointOnLineSegment(
        point,
        lineSegment(closed[i], closed[i + 1]),
        threshold,
      )
    ) {
      on = true;
      break;
    }
  }

  return on;
};

export const polygonInPolygon = <Point extends LocalPoint | GlobalPoint>(
  polygonA: Polygon<Point>,
  polygonB: Polygon<Point>,
) => {
  let inside = true;
  const closed = closePolygon(polygonA);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    const v0 = closed[i];

    // Points test
    if (!pointInPolygon(v0, polygonB)) {
      inside = false;
      break;
    }

    // Lines test
    if (lineIntersectsPolygon(lineSegment(v0, closed[i + 1]), polygonB)) {
      inside = false;
      break;
    }
  }

  return inside;
};

export const polygonIntersectPolygon = <Point extends LocalPoint | GlobalPoint>(
  polygonA: Polygon<Point>,
  polygonB: Polygon<Point>,
) => {
  let intersects = false;
  let onCount = 0;
  const closed = closePolygon(polygonA);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    const v0 = closed[i];
    const v1 = closed[i + 1];

    if (lineIntersectsPolygon(lineSegment(v0, v1), polygonB)) {
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

const distanceToEllipse = <Point extends LocalPoint | GlobalPoint>(
  p: Point,
  ellipse: Ellipse<Point>,
) => {
  const { angle, halfWidth, halfHeight, center } = ellipse;
  const a = halfWidth;
  const b = halfHeight;
  const [rotatedPointX, rotatedPointY] = pointRelativeToCenter(
    p,
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

  return pointDistance(point(rotatedPointX, rotatedPointY), point(minX, minY));
};

export const pointOnEllipse = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  ellipse: Ellipse<Point>,
  threshold = DEFAULT_THRESHOLD,
) => {
  return distanceToEllipse(point, ellipse) <= threshold;
};

export const pointInEllipse = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  ellipse: Ellipse<Point>,
) => {
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

/**
 * Calculates the point two line segments with a definite start and end point
 * intersect at.
 */
export const segmentsIntersectAt = <Point extends GlobalPoint | LocalPoint>(
  a: Readonly<LineSegment<Point>>,
  b: Readonly<LineSegment<Point>>,
): Point | null => {
  const a0 = vectorFromPoint(a[0]);
  const a1 = vectorFromPoint(a[1]);
  const b0 = vectorFromPoint(b[0]);
  const b1 = vectorFromPoint(b[1]);
  const r = vectorSubtract(a1, a0);
  const s = vectorSubtract(b1, b0);
  const denominator = vectorCross(r, s);

  if (denominator === 0) {
    return null;
  }

  const i = vectorSubtract(vectorFromPoint(b[0]), vectorFromPoint(a[0]));
  const u = vectorCross(i, r) / denominator;
  const t = vectorCross(i, s) / denominator;

  if (u === 0) {
    return null;
  }

  const p = vectorAdd(a0, vectorScale(r, t));

  if (t >= 0 && t < 1 && u >= 0 && u < 1) {
    return pointFromVector<Point>(p);
  }

  return null;
};

/**
 * Determine intersection of a rectangular shaped element and a
 * line segment.
 *
 * @param element The rectangular element to test against
 * @param segment The segment intersecting the element
 * @param gap Optional value to inflate the shape before testing
 * @returns An array of intersections
 */
// TODO: Replace with final rounded rectangle code
export const segmentIntersectRectangleElement = <
  Point extends LocalPoint | GlobalPoint,
>(
  element: ExcalidrawBindableElement,
  segment: LineSegment<Point>,
  gap: number = 0,
): Point[] => {
  const bounds = [
    element.x - gap,
    element.y - gap,
    element.x + element.width + gap,
    element.y + element.height + gap,
  ];
  const center = point(
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  );

  return [
    lineSegment(
      pointRotateRads(point(bounds[0], bounds[1]), center, element.angle),
      pointRotateRads(point(bounds[2], bounds[1]), center, element.angle),
    ),
    lineSegment(
      pointRotateRads(point(bounds[2], bounds[1]), center, element.angle),
      pointRotateRads(point(bounds[2], bounds[3]), center, element.angle),
    ),
    lineSegment(
      pointRotateRads(point(bounds[2], bounds[3]), center, element.angle),
      pointRotateRads(point(bounds[0], bounds[3]), center, element.angle),
    ),
    lineSegment(
      pointRotateRads(point(bounds[0], bounds[3]), center, element.angle),
      pointRotateRads(point(bounds[0], bounds[1]), center, element.angle),
    ),
  ]
    .map((s) => segmentsIntersectAt(segment, s))
    .filter((i): i is Point => !!i);
};
