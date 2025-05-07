import {
  isTransparent,
  elementCenterPoint,
  arrayToMap,
} from "@excalidraw/common";
import {
  curve,
  curveIntersectLineSegment,
  isCurve,
  isPointWithinBounds,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
  pointRotateRads,
  pointsEqual,
} from "@excalidraw/math";

import {
  ellipse,
  ellipseSegmentInterceptPoints,
} from "@excalidraw/math/ellipse";

import { isPointInShape, isPointOnShape } from "@excalidraw/utils/collision";

import type { GlobalPoint, LineSegment, Radians } from "@excalidraw/math";

import type { FrameNameBounds } from "@excalidraw/excalidraw/types";

import { isPathALoop } from "./shapes";
import { getElementBounds } from "./bounds";
import {
  hasBoundTextElement,
  isIframeLikeElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import {
  deconstructDiamondElement,
  deconstructRectanguloidElement,
} from "./utils";

import { getBoundTextElement } from "./textElement";

import { LinearElementEditor } from "./linearElementEditor";

import { generateComponentsForCollision } from "./Shape";

import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectanguloidElement,
} from "./types";

import { debugDrawCubicBezier } from "@excalidraw/excalidraw/visualdebug";

export const shouldTestInside = (element: ExcalidrawElement) => {
  if (element.type === "arrow") {
    return false;
  }

  const isDraggableFromInside =
    !isTransparent(element.backgroundColor) ||
    hasBoundTextElement(element) ||
    isIframeLikeElement(element) ||
    isTextElement(element);

  if (element.type === "line") {
    return isDraggableFromInside && isPathALoop(element.points);
  }

  if (element.type === "freedraw") {
    return isDraggableFromInside && isPathALoop(element.points);
  }

  return isDraggableFromInside || isImageElement(element);
};

export type HitTestArgs = {
  point: GlobalPoint;
  element: ExcalidrawElement;
  threshold?: number;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItself = ({
  point,
  element,
  threshold = 10,
  frameNameBound = null,
}: HitTestArgs) => {
  // First check if the element is in the bounding box because it's MUCH faster
  // than checking if the point is in the element's shape
  let hit = hitElementBoundingBox(
    point,
    element,
    arrayToMap([element]),
    threshold,
  )
    ? shouldTestInside(element)
      ? // Since `inShape` tests STRICTLY againt the insides of a shape
        // we would need `onShape` as well to include the "borders"
        isPointInShape(point, element) ||
        isPointOnShape(point, element, threshold)
      : isPointOnShape(point, element, threshold)
    : false;

  element.type === "freedraw" &&
    generateComponentsForCollision(element).forEach((c) => {
      if (isCurve(c)) {
        debugDrawCubicBezier(
          curve(
            pointFrom<GlobalPoint>(element.x + c[0][0], element.y + c[0][1]),
            pointFrom<GlobalPoint>(element.x + c[1][0], element.y + c[1][1]),
            pointFrom<GlobalPoint>(element.x + c[2][0], element.y + c[2][1]),
            pointFrom<GlobalPoint>(element.x + c[3][0], element.y + c[3][1]),
          ),
          { color: "red" },
        );
      }
    });

  // hit test against a frame's name
  if (!hit && frameNameBound) {
    const x1 = frameNameBound.x - threshold;
    const y1 = frameNameBound.y - threshold;
    const x2 = frameNameBound.x + frameNameBound.width + threshold;
    const y2 = frameNameBound.y + frameNameBound.height + threshold;
    hit = isPointWithinBounds(pointFrom(x1, y1), point, pointFrom(x2, y2));
  }

  return hit;
};

export const hitElementBoundingBox = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  tolerance = 0,
) => {
  let [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  x1 -= tolerance;
  y1 -= tolerance;
  x2 += tolerance;
  y2 += tolerance;
  return isPointWithinBounds(pointFrom(x1, y1), point, pointFrom(x2, y2));
};

export const hitElementBoundingBoxOnly = (
  hitArgs: HitTestArgs,
  elementsMap: ElementsMap,
) => {
  return (
    !hitElementItself(hitArgs) &&
    // bound text is considered part of the element (even if it's outside the bounding box)
    !hitElementBoundText(hitArgs.point, hitArgs.element, elementsMap) &&
    hitElementBoundingBox(hitArgs.point, hitArgs.element, elementsMap)
  );
};

export const hitElementBoundText = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const boundTextElementCandidate = getBoundTextElement(element, elementsMap);

  if (!boundTextElementCandidate) {
    return false;
  }
  const boundTextElement = isLinearElement(element)
    ? {
        ...boundTextElementCandidate,
        // arrow's bound text accurate position is not stored in the element's property
        // but rather calculated and returned from the following static method
        ...LinearElementEditor.getBoundTextElementPosition(
          element,
          boundTextElementCandidate,
          elementsMap,
        ),
      }
    : boundTextElementCandidate;

  return isPointInShape(point, boundTextElement);
};

/**
 * Intersect a line with an element for binding test
 *
 * @param element
 * @param line
 * @param offset
 * @returns
 */
export const intersectElementWithLineSegment = (
  element: ExcalidrawElement,
  line: LineSegment<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "selection":
    case "magicframe":
      return intersectRectanguloidWithLineSegment(element, line, offset);
    case "diamond":
      return intersectDiamondWithLineSegment(element, line, offset);
    case "ellipse":
      return intersectEllipseWithLineSegment(element, line, offset);
    case "line":
    case "freedraw":
    case "arrow":
      return [];
    //throw new Error(`Unimplemented element type '${element.type}'`);
  }
};

const intersectRectanguloidWithLineSegment = (
  element: ExcalidrawRectanguloidElement,
  l: LineSegment<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  const center = elementCenterPoint(element);
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedA = pointRotateRads<GlobalPoint>(
    l[0],
    center,
    -element.angle as Radians,
  );
  const rotatedB = pointRotateRads<GlobalPoint>(
    l[1],
    center,
    -element.angle as Radians,
  );

  // Get the element's building components we can test against
  const [sides, corners] = deconstructRectanguloidElement(element, offset);

  return (
    // Test intersection against the sides, keep only the valid
    // intersection points and rotate them back to scene space
    sides
      .map((s) =>
        lineSegmentIntersectionPoints(
          lineSegment<GlobalPoint>(rotatedA, rotatedB),
          s,
        ),
      )
      .filter((x) => x != null)
      .map((j) => pointRotateRads<GlobalPoint>(j!, center, element.angle))
      // Test intersection against the corners which are cubic bezier curves,
      // keep only the valid intersection points and rotate them back to scene
      // space
      .concat(
        corners
          .flatMap((t) =>
            curveIntersectLineSegment(t, lineSegment(rotatedA, rotatedB)),
          )
          .filter((i) => i != null)
          .map((j) => pointRotateRads(j, center, element.angle)),
      )
      // Remove duplicates
      .filter(
        (p, idx, points) => points.findIndex((d) => pointsEqual(p, d)) === idx,
      )
  );
};

/**
 *
 * @param element
 * @param a
 * @param b
 * @returns
 */
const intersectDiamondWithLineSegment = (
  element: ExcalidrawDiamondElement,
  l: LineSegment<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  const center = elementCenterPoint(element);

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  const [sides, curves] = deconstructDiamondElement(element, offset);

  return (
    sides
      .map((s) =>
        lineSegmentIntersectionPoints(
          lineSegment<GlobalPoint>(rotatedA, rotatedB),
          s,
        ),
      )
      .filter((p): p is GlobalPoint => p != null)
      // Rotate back intersection points
      .map((p) => pointRotateRads<GlobalPoint>(p!, center, element.angle))
      .concat(
        curves
          .flatMap((p) =>
            curveIntersectLineSegment(p, lineSegment(rotatedA, rotatedB)),
          )
          .filter((p) => p != null)
          // Rotate back intersection points
          .map((p) => pointRotateRads(p, center, element.angle)),
      )
      // Remove duplicates
      .filter(
        (p, idx, points) => points.findIndex((d) => pointsEqual(p, d)) === idx,
      )
  );
};

/**
 *
 * @param element
 * @param a
 * @param b
 * @returns
 */
const intersectEllipseWithLineSegment = (
  element: ExcalidrawEllipseElement,
  l: LineSegment<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  const center = elementCenterPoint(element);

  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  return ellipseSegmentInterceptPoints(
    ellipse(center, element.width / 2 + offset, element.height / 2 + offset),
    lineSegment(rotatedA, rotatedB),
  ).map((p) => pointRotateRads(p, center, element.angle));
};
