import {
  lineSegment,
  type GlobalPoint,
  vectorFromPoint,
  vectorNormalize,
  vectorScale,
  pointFromVector,
} from "@excalidraw/math";

import { intersectElementWithLineSegment } from "@excalidraw/element/collision";

import { elementCenterPoint } from "@excalidraw/common";

import { distanceToElement } from "@excalidraw/element/distance";

import { isLinearElement } from "@excalidraw/excalidraw";
import { isFreeDrawElement } from "@excalidraw/element/typeChecks";
import { isPathALoop } from "@excalidraw/element/shapes";

import {
  debugClear,
  debugDrawLine,
  debugDrawPoint,
} from "@excalidraw/excalidraw/visualdebug";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Check if the given point is considered on the given shape's border
 *
 * @param point
 * @param element
 * @param tolerance
 * @returns
 */
export const isPointOnShape = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  tolerance = 1,
) => {
  const distance = distanceToElement(element, point);

  return distance <= tolerance;
};

/**
 * Check if the given point is considered inside the element's border
 *
 * @param point
 * @param element
 * @returns
 */
export const isPointInShape = (
  point: GlobalPoint,
  element: ExcalidrawElement,
) => {
  if (
    (isLinearElement(element) || isFreeDrawElement(element)) &&
    !isPathALoop(element.points)
  ) {
    // There isn't any "inside" for a non-looping path
    return false;
  }

  const center = elementCenterPoint(element);
  const otherPoint = pointFromVector(
    vectorScale(
      vectorNormalize(vectorFromPoint(point, center, 0.1)),
      Math.max(element.width, element.height) * 2,
    ),
    center,
  );
  const intersector = lineSegment(point, otherPoint);
  const intersections = intersectElementWithLineSegment(
    element,
    intersector,
  ).filter((item, pos, arr) => arr.indexOf(item) === pos);
  const hit = intersections.length % 2 === 1;

  //debugClear();
  // debugDrawLine(intersector, { color: hit ? "green" : "red", permanent: true });
  // debugDrawPoint(point, { color: "black", permanent: true });
  // debugDrawPoint(otherPoint, { color: "blue", permanent: true });

  //console.log(intersections);

  return hit;
};
