import {
  curvePointDistance,
  distanceToLineSegment,
  pointFrom,
  pointRotateRads,
} from "@excalidraw/math";

import { ellipse, ellipseDistanceFromPoint } from "@excalidraw/math/ellipse";

import type { GlobalPoint, Radians } from "@excalidraw/math";

import {
  deconstructDiamondElement,
  deconstructRectanguloidElement,
} from "./utils";

import type {
  ExcalidrawBindableElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectanguloidElement,
} from "./types";

export const distanceToBindableElement = (
  element: ExcalidrawBindableElement,
  p: GlobalPoint,
): number => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return distanceToRectanguloidElement(element, p);
    case "diamond":
      return distanceToDiamondElement(element, p);
    case "ellipse":
      return distanceToEllipseElement(element, p);
  }
};

/**
 * Returns the distance of a point and the provided rectangular-shaped element,
 * accounting for roundness and rotation
 *
 * @param element The rectanguloid element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the rectanguloid element
 */
const distanceToRectanguloidElement = (
  element: ExcalidrawRectanguloidElement,
  p: GlobalPoint,
) => {
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(p, center, -element.angle as Radians);

  // Get the element's building components we can test against
  const [sides, corners] = deconstructRectanguloidElement(element);

  return Math.min(
    ...sides.map((s) => distanceToLineSegment(rotatedPoint, s)),
    ...corners
      .map((a) => curvePointDistance(a, rotatedPoint))
      .filter((d): d is number => d !== null),
  );
};

/**
 * Returns the distance of a point and the provided diamond element, accounting
 * for roundness and rotation
 *
 * @param element The diamond element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the diamond
 */
const distanceToDiamondElement = (
  element: ExcalidrawDiamondElement,
  p: GlobalPoint,
): number => {
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(p, center, -element.angle as Radians);

  const [sides, curves] = deconstructDiamondElement(element);

  return Math.min(
    ...sides.map((s) => distanceToLineSegment(rotatedPoint, s)),
    ...curves
      .map((a) => curvePointDistance(a, rotatedPoint))
      .filter((d): d is number => d !== null),
  );
};

/**
 * Returns the distance of a point and the provided ellipse element, accounting
 * for roundness and rotation
 *
 * @param element The ellipse element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the ellipse
 */
const distanceToEllipseElement = (
  element: ExcalidrawEllipseElement,
  p: GlobalPoint,
): number => {
  const center = pointFrom(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  return ellipseDistanceFromPoint(
    // Instead of rotating the ellipse, rotate the point to the inverse angle
    pointRotateRads(p, center, -element.angle as Radians),
    ellipse(center, element.width / 2, element.height / 2),
  );
};
