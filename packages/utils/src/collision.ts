import {
  lineSegment,
  pointFrom,
  type GlobalPoint,
  vectorFromPoint,
  vectorNormalize,
  vectorScale,
  pointFromVector,
} from "@excalidraw/math";

import { intersectElementWithLineSegment } from "@excalidraw/element/collision";

import { elementCenterPoint } from "@excalidraw/common";

import { distanceToElement } from "@excalidraw/element/distance";

import { getCommonBounds, isLinearElement } from "@excalidraw/excalidraw";
import { isFreeDrawElement } from "@excalidraw/element/typeChecks";
import { isPathALoop } from "@excalidraw/element/shapes";

import {
  debugDrawLine,
  debugDrawPoint,
} from "@excalidraw/excalidraw/visualdebug";

import type { ExcalidrawElement } from "@excalidraw/element/types";

// check if the given point is considered on the given shape's border
export const isPointOnShape = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  tolerance = 1,
) => {
  const distance = distanceToElement(element, point);

  return distance <= tolerance;
};

// check if the given point is considered inside the element's border
export const isPointInShape = (
  point: GlobalPoint,
  element: ExcalidrawElement,
) => {
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    if (isPathALoop(element.points)) {
      const [minX, minY, maxX, maxY] = getCommonBounds([element]);
      const center = pointFrom<GlobalPoint>(
        (maxX + minX) / 2,
        (maxY + minY) / 2,
      );
      const otherPoint = pointFromVector(
        vectorScale(
          vectorNormalize(vectorFromPoint(point, center, 0.1)),
          Math.max(element.width, element.height) * 2,
        ),
        center,
      );
      const intersector = lineSegment(point, otherPoint);

      // What about being on the center exactly?
      const intersections = intersectElementWithLineSegment(
        element,
        intersector,
      );

      const hit = intersections.length % 2 === 1;

      debugDrawLine(intersector, { color: hit ? "green" : "red" });
      debugDrawPoint(point, { color: "black" });
      debugDrawPoint(otherPoint, { color: "blue" });

      return hit;
    }

    // There isn't any "inside" for a non-looping path
    return false;
  }

  const intersections = intersectElementWithLineSegment(
    element,
    lineSegment(elementCenterPoint(element), point),
  );

  return intersections.length === 0;
};
