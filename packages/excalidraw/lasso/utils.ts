import { simplify } from "points-on-curve";

import type {
  GlobalPoint,
  Line,
  LineSegment,
  LocalPoint,
  Polygon,
} from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type {
  ElementsSegmentsMap,
  LassoWorkerInput,
  LassoWorkerOutput,
} from "./types";

export const updateSelection = (input: LassoWorkerInput): LassoWorkerOutput => {
  const {
    lassoPath,
    elements,
    elementsSegments,
    intersectedElements,
    enclosedElements,
    simplifyDistance,
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  // close the path to form a polygon for enclosure check
  const closedPath = polygonFromPoints(path);
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  for (const element of elements) {
    if (
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      const enclosed = enclosureTest(closedPath, element, elementsSegments);
      if (enclosed) {
        enclosedElements.add(element.id);
      } else {
        const intersects = intersectionTest(
          closedPath,
          element,
          elementsSegments,
        );
        if (intersects) {
          intersectedElements.add(element.id);
        }
      }
    }
  }

  const results = [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
  };
};

const enclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const segments = elementsSegments.get(element.id);
  if (!segments) {
    return false;
  }

  return segments.some((segment) => {
    return segment.some((point) => polygonIncludesPoint(point, lassoPolygon));
  });
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
): boolean => {
  const elementSegments = elementsSegments.get(element.id);
  if (!elementSegments) {
    return false;
  }

  const lassoSegments = lassoPath.reduce((acc, point, index) => {
    if (index === 0) {
      return acc;
    }
    acc.push(lineSegment(lassoPath[index - 1], point));
    return acc;
  }, [] as LineSegment<GlobalPoint>[]);

  return lassoSegments.some((lassoSegment) =>
    elementSegments.some(
      (elementSegment) =>
        // introduce a bit of tolerance to account for roughness and simplification of paths
        lineSegmentIntersectionPoints(lassoSegment, elementSegment, 1) !== null,
    ),
  );
};

export function polygonFromPoints<Point extends GlobalPoint | LocalPoint>(
  points: Point[],
) {
  return polygonClose(points) as Polygon<Point>;
}

function polygonClose<Point extends LocalPoint | GlobalPoint>(
  polygon: Point[],
) {
  return polygonIsClosed(polygon)
    ? polygon
    : ([...polygon, polygon[0]] as Polygon<Point>);
}

function polygonIsClosed<Point extends LocalPoint | GlobalPoint>(
  polygon: Point[],
) {
  return pointsEqual(polygon[0], polygon[polygon.length - 1]);
}

const PRECISION = 10e-5;

function pointsEqual<Point extends GlobalPoint | LocalPoint>(
  a: Point,
  b: Point,
): boolean {
  const abs = Math.abs;
  return abs(a[0] - b[0]) < PRECISION && abs(a[1] - b[1]) < PRECISION;
}

const polygonIncludesPoint = <Point extends LocalPoint | GlobalPoint>(
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

function lineSegment<P extends GlobalPoint | LocalPoint>(
  a: P,
  b: P,
): LineSegment<P> {
  return [a, b] as LineSegment<P>;
}

function lineSegmentIntersectionPoints<Point extends GlobalPoint | LocalPoint>(
  l: LineSegment<Point>,
  s: LineSegment<Point>,
  threshold?: number,
): Point | null {
  const candidate = linesIntersectAt(line(l[0], l[1]), line(s[0], s[1]));

  if (
    !candidate ||
    !pointOnLineSegment(candidate, s, threshold) ||
    !pointOnLineSegment(candidate, l, threshold)
  ) {
    return null;
  }

  return candidate;
}

function linesIntersectAt<Point extends GlobalPoint | LocalPoint>(
  a: Line<Point>,
  b: Line<Point>,
): Point | null {
  const A1 = a[1][1] - a[0][1];
  const B1 = a[0][0] - a[1][0];
  const A2 = b[1][1] - b[0][1];
  const B2 = b[0][0] - b[1][0];
  const D = A1 * B2 - A2 * B1;
  if (D !== 0) {
    const C1 = A1 * a[0][0] + B1 * a[0][1];
    const C2 = A2 * b[0][0] + B2 * b[0][1];
    return pointFrom<Point>((C1 * B2 - C2 * B1) / D, (A1 * C2 - A2 * C1) / D);
  }

  return null;
}

function line<P extends GlobalPoint | LocalPoint>(a: P, b: P): Line<P> {
  return [a, b] as Line<P>;
}

const pointOnLineSegment = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  line: LineSegment<Point>,
  threshold = PRECISION,
) => {
  const distance = distanceToLineSegment(point, line);

  if (distance === 0) {
    return true;
  }

  return distance < threshold;
};

const distanceToLineSegment = <Point extends LocalPoint | GlobalPoint>(
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

function pointFrom<Point extends GlobalPoint | LocalPoint>(
  x: number,
  y: number,
): Point {
  return [x, y] as Point;
}
