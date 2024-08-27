import { lineSegment, pointOnLineSegment } from "./segment";
import type { GlobalPoint, LocalPoint, Polygon } from "./types";
import { closePolygon, PRECISION } from "./utils";

export function polygon<Point extends GlobalPoint | LocalPoint>(
  ...points: Point[]
) {
  return points as Polygon<Point>;
}

export function polygonFromPoints<Point extends GlobalPoint | LocalPoint>(
  points: Point[],
) {
  return points as Polygon<Point>;
}

export function polygonIsClosed<Point extends LocalPoint | GlobalPoint>(
  polygon: Polygon<Point>,
) {
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

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
  p: Point,
  polygon: Polygon<Point>,
  threshold = PRECISION,
) => {
  let on = false;
  const closed = closePolygon(polygon);

  for (let i = 0, l = closed.length - 1; i < l; i++) {
    if (
      pointOnLineSegment(p, lineSegment(closed[i], closed[i + 1]), threshold)
    ) {
      on = true;
      break;
    }
  }

  return on;
};

// export const polygonInPolygon = <Point extends LocalPoint | GlobalPoint>(
//   polygonA: Polygon<Point>,
//   polygonB: Polygon<Point>,
// ) => {
//   let inside = true;
//   const closed = closePolygon(polygonA);

//   for (let i = 0, l = closed.length - 1; i < l; i++) {
//     const v0 = closed[i];

//     // Points test
//     if (!pointInPolygon(v0, polygonB)) {
//       inside = false;
//       break;
//     }

//     // Lines test
//     if (lineIntersectsPolygon(lineSegment(v0, closed[i + 1]), polygonB)) {
//       inside = false;
//       break;
//     }
//   }

//   return inside;
// };

// export const polygonIntersectPolygon = <Point extends LocalPoint | GlobalPoint>(
//   polygonA: Polygon<Point>,
//   polygonB: Polygon<Point>,
// ) => {
//   let intersects = false;
//   let onCount = 0;
//   const closed = closePolygon(polygonA);

//   for (let i = 0, l = closed.length - 1; i < l; i++) {
//     const v0 = closed[i];
//     const v1 = closed[i + 1];

//     if (lineIntersectsPolygon(lineSegment(v0, v1), polygonB)) {
//       intersects = true;
//       break;
//     }

//     if (pointOnPolygon(v0, polygonB)) {
//       ++onCount;
//     }

//     if (onCount === 2) {
//       intersects = true;
//       break;
//     }
//   }

//   return intersects;
// };

// export const lineIntersectsPolygon = <Point extends LocalPoint | GlobalPoint>(
//   line: LineSegment<Point>,
//   polygon: Polygon<Point>,
// ) => {
//   let intersects = false;
//   const closed = closePolygon(polygon);

//   for (let i = 0, l = closed.length - 1; i < l; i++) {
//     const v0 = closed[i];
//     const v1 = closed[i + 1];

//     if (
//       lineIntersectsLine(line, lineSegment(v0, v1)) ||
//       (pointOnLineSegment(v0, line) && pointOnLineSegment(v1, line))
//     ) {
//       intersects = true;
//       break;
//     }
//   }

//   return intersects;
// };

// export const polygonRotate = <Point extends LocalPoint | GlobalPoint>(
//   polygon: Polygon<Point>,
//   angle: Radians,
//   origin: Point,
// ) => {
//   return polygon.map((p) => pointRotateRads(p, origin, angle));
// };

// export const polygonBounds = <Point extends LocalPoint | GlobalPoint>(
//   polygon: Polygon<Point>,
// ) => {
//   let xMin = Infinity;
//   let xMax = -Infinity;
//   let yMin = Infinity;
//   let yMax = -Infinity;

//   for (let i = 0, l = polygon.length; i < l; i++) {
//     const p = polygon[i];
//     const x = p[0];
//     const y = p[1];

//     if (x != null && isFinite(x) && y != null && isFinite(y)) {
//       if (x < xMin) {
//         xMin = x;
//       }
//       if (x > xMax) {
//         xMax = x;
//       }
//       if (y < yMin) {
//         yMin = y;
//       }
//       if (y > yMax) {
//         yMax = y;
//       }
//     }
//   }

//   return [
//     [xMin, yMin],
//     [xMax, yMax],
//   ];
// };

// export const polygonCentroid = <Point extends LocalPoint | GlobalPoint>(
//   vertices: Point[],
// ) => {
//   let a = 0;
//   let x = 0;
//   let y = 0;
//   const l = vertices.length;

//   for (let i = 0; i < l; i++) {
//     const s = i === l - 1 ? 0 : i + 1;
//     const v0 = vertices[i];
//     const v1 = vertices[s];
//     const f = v0[0] * v1[1] - v1[0] * v0[1];

//     a += f;
//     x += (v0[0] + v1[0]) * f;
//     y += (v0[1] + v1[1]) * f;
//   }

//   const d = a * 3;

//   return [x / d, y / d] as Point;
// };

// export const polygonTranslate = <Point extends LocalPoint | GlobalPoint>(
//   polygon: Polygon<Point>,
//   angle: number,
//   distance: number,
// ) => {
//   return polygon.map((p) =>
//     pointTranslate(
//       pointRotateRads(p, point(0, 0), angle as Radians),
//       vector(distance, distance),
//     ),
//   );
// };
