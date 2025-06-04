import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import {
  type Bounds,
  doBoundsIntersect,
  getElementBounds,
  intersectElementWithLineSegment,
} from "@excalidraw/element";

import type { ElementsSegmentsMap, GlobalPoint } from "@excalidraw/math/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { debugDrawBounds } from "../visualdebug";

export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
  getElementThreshold: (element: ExcalidrawElement) => number;
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
    getElementThreshold,
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  const unlockedElements = elements.filter((el) => !el.locked);
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  const lassoBounds = lassoPath.reduce(
    (acc, item) => {
      return [
        Math.min(acc[0], item[0]),
        Math.min(acc[1], item[1]),
        Math.max(acc[2], item[0]),
        Math.max(acc[3], item[1]),
      ];
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  ) as Bounds;
  for (const element of unlockedElements) {
    const threshold = getElementThreshold(element);
    // First check if the lasso segment intersects the element's axis-aligned
    // bounding box as it is much faster than checking intersection against
    // the element's shape
    const snugElementBounds = getElementBounds(element, new Map());
    const elementBounds = [
      snugElementBounds[0] - threshold,
      snugElementBounds[1] - threshold,
      snugElementBounds[2] + threshold,
      snugElementBounds[3] + threshold,
    ] as Bounds;

    if (
      doBoundsIntersect(lassoBounds, elementBounds) &&
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      const enclosed = enclosureTest(path, element, elementsSegments);
      if (enclosed) {
        enclosedElements.add(element.id);
      } else {
        const intersects = intersectionTest(path, element, threshold);
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
    return segment.some((point) =>
      polygonIncludesPointNonZero(point, lassoPolygon),
    );
  });
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  hitThreshold: number,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);

  return lassoSegments.some(
    (lassoSegment) =>
      intersectElementWithLineSegment(element, lassoSegment, hitThreshold)
        .length > 0,
  );
};
