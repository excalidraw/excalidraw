import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  polygonIncludesPoint,
  lineSegment,
  lineSegmentIntersectionPoints,
} from "@excalidraw/math";

import type { GlobalPoint, LineSegment } from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

export type ElementsSegmentsMap = Map<string, LineSegment<GlobalPoint>[]>;

export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
}): {
  selectedElementIds: string[];
} => {
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
