import {
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Radians,
} from "../../math/types";
import { pointFrom, pointRotateRads } from "../../math/point";
import { polygonFromPoints } from "../../math/polygon";
import { ElementsMap, ExcalidrawElement } from "../element/types";
import { pointsOnBezierCurves, simplify } from "points-on-curve";
import { lineSegment } from "../../math/segment";
import throttle from "lodash.throttle";
import { RoughGenerator } from "roughjs/bin/generator";
import { Point } from "roughjs/bin/geometry";
import { Drawable, Op } from "roughjs/bin/core";

// variables to track processing state and latest input data
// for "backpressure" purposes
let isProcessing: boolean = false;
let latestInputData: LassoWorkerInput | null = null;

self.onmessage = (event: MessageEvent<LassoWorkerInput>) => {
  if (!event.data) {
    self.postMessage({
      error: "No data received",
      selectedElementIds: [],
    });
    return;
  }

  latestInputData = event.data;

  if (!isProcessing) {
    processInputData();
  }
};

// function to process the latest data
const processInputData = () => {
  // If no data to process, return
  if (!latestInputData) return;

  // capture the current data to process and reset latestData
  const dataToProcess = latestInputData;
  latestInputData = null; // reset to avoid re-processing the same data
  isProcessing = true;

  try {
    const { lassoPath, elements, intersectedElements, enclosedElements } =
      dataToProcess;

    if (!Array.isArray(lassoPath) || !Array.isArray(elements)) {
      throw new Error("Invalid input: lassoPath and elements must be arrays");
    }

    if (
      !(intersectedElements instanceof Set) ||
      !(enclosedElements instanceof Set)
    ) {
      throw new Error(
        "Invalid input: intersectedElements and enclosedElements must be Sets",
      );
    }

    const result = updateSelection(dataToProcess);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      selectedElementIds: [],
    });
  } finally {
    isProcessing = false;
    // if new data arrived during processing, process it
    // as we're done with processing the previous data
    if (latestInputData) {
      processInputData();
    }
  }
};

export type LassoWorkerInput = {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
};

export type LassoWorkerOutput = {
  selectedElementIds: string[];
};

export const updateSelection = throttle(
  (input: LassoWorkerInput): LassoWorkerOutput => {
    const { lassoPath, elements, intersectedElements, enclosedElements } =
      input;

    const elementsMap = arrayToMap(elements);
    // simplify the path to reduce the number of points
    const simplifiedPath = simplify(lassoPath, 0.75) as GlobalPoint[];
    // close the path to form a polygon for enclosure check
    const closedPath = polygonFromPoints(simplifiedPath);
    // as the path might not enclose a shape anymore, clear before checking
    enclosedElements.clear();
    for (const [, element] of elementsMap) {
      if (
        !intersectedElements.has(element.id) &&
        !enclosedElements.has(element.id)
      ) {
        const enclosed = enclosureTest(closedPath, element, elementsMap);
        if (enclosed) {
          enclosedElements.add(element.id);
        } else {
          const intersects = intersectionTest(closedPath, element, elementsMap);
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
  },
  100,
);

const enclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const segments = getElementLineSegments(element, elementsMap);

  return segments.some((segment) => {
    return segment.some((point) => isPointInPolygon(point, lassoPolygon));
  });
};

// // Helper function to check if a point is inside a polygon
const isPointInPolygon = (
  point: GlobalPoint,
  polygon: GlobalPoint[],
): boolean => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const elementSegments = getElementLineSegments(element, elementsMap);

  const lassoSegments = lassoPath.reduce((acc, point, index) => {
    if (index === 0) return acc;
    acc.push([lassoPath[index - 1], point] as [GlobalPoint, GlobalPoint]);
    return acc;
  }, [] as [GlobalPoint, GlobalPoint][]);

  return lassoSegments.some((lassoSegment) =>
    elementSegments.some((elementSegment) =>
      doLineSegmentsIntersect(lassoSegment, elementSegment),
    ),
  );
};

// Helper function to check if two line segments intersect
const doLineSegmentsIntersect = (
  [p1, p2]: [GlobalPoint, GlobalPoint],
  [p3, p4]: [GlobalPoint, GlobalPoint],
): boolean => {
  const denominator =
    (p4[1] - p3[1]) * (p2[0] - p1[0]) - (p4[0] - p3[0]) * (p2[1] - p1[1]);

  if (denominator === 0) return false;

  const ua =
    ((p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0])) /
    denominator;
  const ub =
    ((p2[0] - p1[0]) * (p1[1] - p3[1]) - (p2[1] - p1[1]) * (p1[0] - p3[0])) /
    denominator;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
};

const getCurvePathOps = (shape: Drawable): Op[] => {
  for (const set of shape.sets) {
    if (set.type === "path") {
      return set.ops;
    }
  }
  return shape.sets[0].ops;
};

const getElementLineSegments = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): LineSegment<GlobalPoint>[] => {
  const [x1, y1, x2, y2, cx, cy] = [
    element.x,
    element.y,
    element.x + element.width,
    element.y + element.height,
    element.x + element.width / 2,
    element.y + element.height / 2,
  ];

  const center: GlobalPoint = pointFrom(cx, cy);

  if (
    element.type === "line" ||
    element.type === "arrow" ||
    element.type === "freedraw"
  ) {
    const segments: LineSegment<GlobalPoint>[] = [];

    const getPointsOnCurve = () => {
      const generator = new RoughGenerator();

      const drawable = generator.curve(element.points as unknown as Point[]);

      const ops = getCurvePathOps(drawable);

      const _points: LocalPoint[] = [];
      // let odd = false;
      // for (const operation of ops) {
      //   if (operation.op === "move") {
      //     odd = !odd;
      //     if (odd) {
      //       if (
      //         Array.isArray(operation.data) &&
      //         operation.data.length >= 2 &&
      //         operation.data.every(
      //           (d) => d !== undefined && typeof d === "number",
      //         )
      //       ) {
      //         _points.push(pointFrom(operation.data[0], operation.data[1]));
      //       }
      //     }
      //   } else if (operation.op === "bcurveTo") {
      //     if (odd) {
      //       if (
      //         Array.isArray(operation.data) &&
      //         operation.data.length === 6 &&
      //         operation.data.every(
      //           (d) => d !== undefined && typeof d === "number",
      //         )
      //       ) {
      //         _points.push(pointFrom(operation.data[0], operation.data[1]));
      //         _points.push(pointFrom(operation.data[2], operation.data[3]));
      //         _points.push(pointFrom(operation.data[4], operation.data[5]));
      //       }
      //     }
      //   } else if (operation.op === "lineTo") {
      //     if (
      //       Array.isArray(operation.data) &&
      //       operation.data.length >= 2 &&
      //       odd &&
      //       operation.data.every(
      //         (d) => d !== undefined && typeof d === "number",
      //       )
      //     ) {
      //       _points.push(pointFrom(operation.data[0], operation.data[1]));
      //     }
      //   }
      // }

      return pointsOnBezierCurves(_points, 10, 5);
    };

    let i = 0;

    // const points =
    //   element.roughness !== 0 && element.type !== "freedraw"
    //     ? getPointsOnCurve()
    //     : element.points;

    const points = element.points;

    while (i < points.length - 1) {
      segments.push(
        lineSegment(
          pointRotateRads(
            pointFrom(
              element.points[i][0] + element.x,
              element.points[i][1] + element.y,
            ),
            center,
            element.angle,
          ),
          pointRotateRads(
            pointFrom(
              element.points[i + 1][0] + element.x,
              element.points[i + 1][1] + element.y,
            ),
            center,
            element.angle,
          ),
        ),
      );
      i++;
    }

    return segments;
  }

  const [nw, ne, sw, se, n, s, w, e] = (
    [
      [x1, y1],
      [x2, y1],
      [x1, y2],
      [x2, y2],
      [cx, y1],
      [cx, y2],
      [x1, cy],
      [x2, cy],
    ] as GlobalPoint[]
  ).map((point) => pointRotateRads(point, center, element.angle));

  if (element.type === "diamond") {
    return [
      lineSegment(n, w),
      lineSegment(n, e),
      lineSegment(s, w),
      lineSegment(s, e),
    ];
  }

  if (element.type === "ellipse") {
    return [
      lineSegment(n, w),
      lineSegment(n, e),
      lineSegment(s, w),
      lineSegment(s, e),
      lineSegment(n, w),
      lineSegment(n, e),
      lineSegment(s, w),
      lineSegment(s, e),
    ];
  }

  if (element.type === "frame" || element.type === "magicframe") {
    return [
      lineSegment(nw, ne),
      lineSegment(ne, se),
      lineSegment(se, sw),
      lineSegment(sw, nw),
    ];
  }

  return [
    lineSegment(nw, ne),
    lineSegment(sw, se),
    lineSegment(nw, sw),
    lineSegment(ne, se),
    lineSegment(nw, e),
    lineSegment(sw, e),
    lineSegment(ne, w),
    lineSegment(se, w),
  ];
};

// This is a copy of arrayToMap from utils.ts
// copy to avoid accessing DOM related things in worker
const arrayToMap = <T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) => {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
};
