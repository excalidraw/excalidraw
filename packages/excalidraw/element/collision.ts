import {
  curveIntersectLineSegment,
  isPointWithinBounds,
  line,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
  pointRotateRads,
  pointsEqual,
} from "@excalidraw/math";
import {
  ellipse,
  ellipseLineIntersectionPoints,
} from "@excalidraw/math/ellipse";
import { isPointInShape, isPointOnShape } from "@excalidraw/utils/collision";
import { getPolygonShape } from "@excalidraw/utils/geometry/shape";

import type {
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Polygon,
  Radians,
} from "@excalidraw/math";
import type { GeometricShape } from "@excalidraw/utils/geometry/shape";

import { getBoundTextShape, isPathALoop } from "../shapes";
import { isTransparent } from "../utils";

import { getElementBounds } from "./bounds";
import {
  hasBoundTextElement,
  isIframeLikeElement,
  isImageElement,
  isTextElement,
} from "./typeChecks";
import {
  deconstructDiamondElement,
  deconstructRectanguloidElement,
} from "./utils";

import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectangleElement,
  ExcalidrawRectanguloidElement,
} from "./types";
import type { FrameNameBounds } from "../types";

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

export type HitTestArgs<Point extends GlobalPoint | LocalPoint> = {
  x: number;
  y: number;
  element: ExcalidrawElement;
  shape: GeometricShape<Point>;
  threshold?: number;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItself = <Point extends GlobalPoint | LocalPoint>({
  x,
  y,
  element,
  shape,
  threshold = 10,
  frameNameBound = null,
}: HitTestArgs<Point>) => {
  let hit = shouldTestInside(element)
    ? // Since `inShape` tests STRICTLY againt the insides of a shape
      // we would need `onShape` as well to include the "borders"
      isPointInShape(pointFrom(x, y), shape) ||
      isPointOnShape(pointFrom(x, y), shape, threshold)
    : isPointOnShape(pointFrom(x, y), shape, threshold);

  // hit test against a frame's name
  if (!hit && frameNameBound) {
    hit = isPointInShape(pointFrom(x, y), {
      type: "polygon",
      data: getPolygonShape(frameNameBound as ExcalidrawRectangleElement)
        .data as Polygon<Point>,
    });
  }

  return hit;
};

export const hitElementBoundingBox = (
  x: number,
  y: number,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  tolerance = 0,
) => {
  let [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  x1 -= tolerance;
  y1 -= tolerance;
  x2 += tolerance;
  y2 += tolerance;
  return isPointWithinBounds(
    pointFrom(x1, y1),
    pointFrom(x, y),
    pointFrom(x2, y2),
  );
};

export const hitElementBoundingBoxOnly = <
  Point extends GlobalPoint | LocalPoint,
>(
  hitArgs: HitTestArgs<Point>,
  elementsMap: ElementsMap,
) => {
  return (
    !hitElementItself(hitArgs) &&
    // bound text is considered part of the element (even if it's outside the bounding box)
    !hitElementBoundText(
      hitArgs.x,
      hitArgs.y,
      getBoundTextShape(hitArgs.element, elementsMap),
    ) &&
    hitElementBoundingBox(hitArgs.x, hitArgs.y, hitArgs.element, elementsMap)
  );
};

export const hitElementBoundText = <Point extends GlobalPoint | LocalPoint>(
  x: number,
  y: number,
  textShape: GeometricShape<Point> | null,
): boolean => {
  return !!textShape && isPointInShape(pointFrom(x, y), textShape);
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
    case "magicframe":
      return intersectRectanguloidWithLineSegment(element, line, offset);
    case "diamond":
      return intersectDiamondWithLineSegment(element, line, offset);
    case "ellipse":
      return intersectEllipseWithLineSegment(element, line, offset);
    default:
      throw new Error(`Unimplemented element type '${element.type}'`);
  }
};

const intersectRectanguloidWithLineSegment = (
  element: ExcalidrawRectanguloidElement,
  l: LineSegment<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
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
    [
      // Test intersection against the sides, keep only the valid
      // intersection points and rotate them back to scene space
      ...sides
        .map((s) =>
          lineSegmentIntersectionPoints(
            lineSegment<GlobalPoint>(rotatedA, rotatedB),
            s,
          ),
        )
        .filter((x) => x != null)
        .map((j) => pointRotateRads<GlobalPoint>(j!, center, element.angle)),
      // Test intersection against the corners which are cubic bezier curves,
      // keep only the valid intersection points and rotate them back to scene
      // space
      ...corners
        .flatMap((t) =>
          curveIntersectLineSegment(t, lineSegment(rotatedA, rotatedB)),
        )
        .filter((i) => i != null)
        .map((j) => pointRotateRads(j, center, element.angle)),
    ]
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
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  const [sides, curves] = deconstructDiamondElement(element, offset);

  return (
    [
      ...sides
        .map((s) =>
          lineSegmentIntersectionPoints(
            lineSegment<GlobalPoint>(rotatedA, rotatedB),
            s,
          ),
        )
        .filter((p): p is GlobalPoint => p != null)
        // Rotate back intersection points
        .map((p) => pointRotateRads<GlobalPoint>(p!, center, element.angle)),
      ...curves
        .flatMap((p) =>
          curveIntersectLineSegment(p, lineSegment(rotatedA, rotatedB)),
        )
        .filter((p) => p != null)
        // Rotate back intersection points
        .map((p) => pointRotateRads(p, center, element.angle)),
    ]
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
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  return ellipseLineIntersectionPoints(
    ellipse(center, element.width / 2 + offset, element.height / 2 + offset),
    line(rotatedA, rotatedB),
  ).map((p) => pointRotateRads(p, center, element.angle));
};
