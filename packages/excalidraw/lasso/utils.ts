import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  lineSegmentIntersectionPoints,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
} from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { intersectElementWithLineSegment } from "@excalidraw/element";
import App from "../components/App";

export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
}): {
  selectedElementIds: string[];
} => {
  const {
    lassoPath,
    elements,
    intersectedElements,
    enclosedElements,
    simplifyDistance,
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  const unlockedElements = elements.filter((el) => !el.locked);
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  for (const element of unlockedElements) {
    if (
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      const enclosed = enclosureTest(path, element, elementsSegments);
      if (enclosed) {
        enclosedElements.add(element.id);
      } else {
        const intersects = intersectionTest(path, element, app);
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
  app: App,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point, index) => lineSegment(lassoPath[index], point))
    .concat(lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0]));
  const offset = app.getElementHitThreshold();

  return segments.some((segment) => {
    return segment.some((point) =>
      polygonIncludesPointNonZero(point, lassoPolygon),
    );
  });
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  app: App,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point, index) => lineSegment(lassoPath[index], point))
    .concat(lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0]));
  const offset = app.getElementHitThreshold();

  return lassoSegments.some((lassoSegment) =>
    intersectElementWithLineSegment(element, lassoSegment, offset),
  );
};
