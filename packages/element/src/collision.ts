import { isTransparent } from "@excalidraw/common";
import {
  curveIntersectLineSegment,
  isPointWithinBounds,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
  pointFromVector,
  pointRotateRads,
  pointsEqual,
  vectorFromPoint,
  vectorNormalize,
  vectorScale,
} from "@excalidraw/math";

import {
  ellipse,
  ellipseSegmentInterceptPoints,
} from "@excalidraw/math/ellipse";

import type {
  Curve,
  GlobalPoint,
  LineSegment,
  Radians,
} from "@excalidraw/math";

import type { FrameNameBounds } from "@excalidraw/excalidraw/types";

import { isPathALoop } from "./utils";
import {
  type Bounds,
  doBoundsIntersect,
  elementCenterPoint,
  getCenterForBounds,
  getCubicBezierCurveBound,
  getElementBounds,
} from "./bounds";
import {
  hasBoundTextElement,
  isFreeDrawElement,
  isIframeLikeElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import {
  deconstructDiamondElement,
  deconstructLinearOrFreeDrawElement,
  deconstructRectanguloidElement,
} from "./utils";

import { getBoundTextElement } from "./textElement";

import { LinearElementEditor } from "./linearElementEditor";

import { distanceToElement } from "./distance";

import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectanguloidElement,
} from "./types";

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
  threshold: number;
  elementsMap: ElementsMap;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItself = ({
  point,
  element,
  threshold,
  elementsMap,
  frameNameBound = null,
}: HitTestArgs) => {
  // Hit test against a frame's name
  const hitFrameName = frameNameBound
    ? isPointWithinBounds(
        pointFrom(frameNameBound.x - threshold, frameNameBound.y - threshold),
        point,
        pointFrom(
          frameNameBound.x + frameNameBound.width + threshold,
          frameNameBound.y + frameNameBound.height + threshold,
        ),
      )
    : false;

  // Hit test against the extended, rotated bounding box of the element first
  const bounds = getElementBounds(element, elementsMap, true);
  const hitBounds = isPointWithinBounds(
    pointFrom(bounds[0] - threshold, bounds[1] - threshold),
    pointRotateRads(
      point,
      getCenterForBounds(bounds),
      -element.angle as Radians,
    ),
    pointFrom(bounds[2] + threshold, bounds[3] + threshold),
  );

  // PERF: Bail out early if the point is not even in the
  // rotated bounding box or not hitting the frame name (saves 99%)
  if (!hitBounds && !hitFrameName) {
    return false;
  }

  // Do the precise (and relatively costly) hit test
  const hitElement = shouldTestInside(element)
    ? // Since `inShape` tests STRICTLY againt the insides of a shape
      // we would need `onShape` as well to include the "borders"
      isPointInElement(point, element, elementsMap) ||
      isPointOnElementOutline(point, element, elementsMap, threshold)
    : isPointOnElementOutline(point, element, elementsMap, threshold);

  return hitElement || hitFrameName;
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
) =>
  !hitElementItself(hitArgs) &&
  // bound text is considered part of the element (even if it's outside the bounding box)
  !hitElementBoundText(hitArgs.point, hitArgs.element, elementsMap) &&
  hitElementBoundingBox(hitArgs.point, hitArgs.element, elementsMap);

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

  return isPointInElement(point, boundTextElement, elementsMap);
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
  elementsMap: ElementsMap,
  line: LineSegment<GlobalPoint>,
  offset: number = 0,
  onlyFirst = false,
): GlobalPoint[] => {
  // First check if the line intersects the element's axis-aligned bounding box
  // as it is much faster than checking intersection against the element's shape
  const intersectorBounds = [
    Math.min(line[0][0] - offset, line[1][0] - offset),
    Math.min(line[0][1] - offset, line[1][1] - offset),
    Math.max(line[0][0] + offset, line[1][0] + offset),
    Math.max(line[0][1] + offset, line[1][1] + offset),
  ] as Bounds;
  const elementBounds = getElementBounds(element, elementsMap);

  if (!doBoundsIntersect(intersectorBounds, elementBounds)) {
    return [];
  }

  // Do the actual intersection test against the element's shape
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "selection":
    case "magicframe":
      return intersectRectanguloidWithLineSegment(
        element,
        elementsMap,
        line,
        offset,
        onlyFirst,
      );
    case "diamond":
      return intersectDiamondWithLineSegment(
        element,
        elementsMap,
        line,
        offset,
        onlyFirst,
      );
    case "ellipse":
      return intersectEllipseWithLineSegment(
        element,
        elementsMap,
        line,
        offset,
      );
    case "line":
    case "freedraw":
    case "arrow":
      return intersectLinearOrFreeDrawWithLineSegment(element, line, onlyFirst);
  }
};

const curveIntersections = (
  curves: Curve<GlobalPoint>[],
  segment: LineSegment<GlobalPoint>,
  intersections: GlobalPoint[],
  center: GlobalPoint,
  angle: Radians,
  onlyFirst = false,
) => {
  for (const c of curves) {
    // Optimize by doing a cheap bounding box check first
    const b1 = getCubicBezierCurveBound(c[0], c[1], c[2], c[3]);
    const b2 = [
      Math.min(segment[0][0], segment[1][0]),
      Math.min(segment[0][1], segment[1][1]),
      Math.max(segment[0][0], segment[1][0]),
      Math.max(segment[0][1], segment[1][1]),
    ] as Bounds;

    if (!doBoundsIntersect(b1, b2)) {
      continue;
    }

    const hits = curveIntersectLineSegment(c, segment);

    if (hits.length > 0) {
      for (const j of hits) {
        intersections.push(pointRotateRads(j, center, angle));
      }

      if (onlyFirst) {
        return intersections;
      }
    }
  }

  return intersections;
};

const lineIntersections = (
  lines: LineSegment<GlobalPoint>[],
  segment: LineSegment<GlobalPoint>,
  intersections: GlobalPoint[],
  center: GlobalPoint,
  angle: Radians,
  onlyFirst = false,
) => {
  for (const l of lines) {
    const intersection = lineSegmentIntersectionPoints(l, segment);
    if (intersection) {
      intersections.push(pointRotateRads(intersection, center, angle));

      if (onlyFirst) {
        return intersections;
      }
    }
  }

  return intersections;
};

const intersectLinearOrFreeDrawWithLineSegment = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
  segment: LineSegment<GlobalPoint>,
  onlyFirst = false,
): GlobalPoint[] => {
  // NOTE: This is the only one which return the decomposed elements
  // rotated! This is due to taking advantage of roughjs definitions.
  const [lines, curves] = deconstructLinearOrFreeDrawElement(element);
  const intersections: GlobalPoint[] = [];

  for (const l of lines) {
    const intersection = lineSegmentIntersectionPoints(l, segment);
    if (intersection) {
      intersections.push(intersection);

      if (onlyFirst) {
        return intersections;
      }
    }
  }

  for (const c of curves) {
    // Optimize by doing a cheap bounding box check first
    const b1 = getCubicBezierCurveBound(c[0], c[1], c[2], c[3]);
    const b2 = [
      Math.min(segment[0][0], segment[1][0]),
      Math.min(segment[0][1], segment[1][1]),
      Math.max(segment[0][0], segment[1][0]),
      Math.max(segment[0][1], segment[1][1]),
    ] as Bounds;

    if (!doBoundsIntersect(b1, b2)) {
      continue;
    }

    const hits = curveIntersectLineSegment(c, segment);

    if (hits.length > 0) {
      intersections.push(...hits);

      if (onlyFirst) {
        return intersections;
      }
    }
  }

  return intersections;
};

const intersectRectanguloidWithLineSegment = (
  element: ExcalidrawRectanguloidElement,
  elementsMap: ElementsMap,
  segment: LineSegment<GlobalPoint>,
  offset: number = 0,
  onlyFirst = false,
): GlobalPoint[] => {
  const center = elementCenterPoint(element, elementsMap);
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedA = pointRotateRads<GlobalPoint>(
    segment[0],
    center,
    -element.angle as Radians,
  );
  const rotatedB = pointRotateRads<GlobalPoint>(
    segment[1],
    center,
    -element.angle as Radians,
  );
  const rotatedIntersector = lineSegment(rotatedA, rotatedB);

  // Get the element's building components we can test against
  const [sides, corners] = deconstructRectanguloidElement(element, offset);

  const intersections: GlobalPoint[] = [];

  lineIntersections(
    sides,
    rotatedIntersector,
    intersections,
    center,
    element.angle,
    onlyFirst,
  );

  if (onlyFirst && intersections.length > 0) {
    return intersections;
  }

  curveIntersections(
    corners,
    rotatedIntersector,
    intersections,
    center,
    element.angle,
    onlyFirst,
  );

  return intersections;
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
  elementsMap: ElementsMap,
  l: LineSegment<GlobalPoint>,
  offset: number = 0,
  onlyFirst = false,
): GlobalPoint[] => {
  const center = elementCenterPoint(element, elementsMap);

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);
  const rotatedIntersector = lineSegment(rotatedA, rotatedB);

  const [sides, corners] = deconstructDiamondElement(element, offset);
  const intersections: GlobalPoint[] = [];

  lineIntersections(
    sides,
    rotatedIntersector,
    intersections,
    center,
    element.angle,
    onlyFirst,
  );

  if (onlyFirst && intersections.length > 0) {
    return intersections;
  }

  curveIntersections(
    corners,
    rotatedIntersector,
    intersections,
    center,
    element.angle,
    onlyFirst,
  );

  return intersections;
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
  elementsMap: ElementsMap,
  l: LineSegment<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  const center = elementCenterPoint(element, elementsMap);

  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  return ellipseSegmentInterceptPoints(
    ellipse(center, element.width / 2 + offset, element.height / 2 + offset),
    lineSegment(rotatedA, rotatedB),
  ).map((p) => pointRotateRads(p, center, element.angle));
};

/**
 * Check if the given point is considered on the given shape's border
 *
 * @param point
 * @param element
 * @param tolerance
 * @returns
 */
const isPointOnElementOutline = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  tolerance = 1,
) => distanceToElement(element, elementsMap, point) <= tolerance;

/**
 * Check if the given point is considered inside the element's border
 *
 * @param point
 * @param element
 * @returns
 */
export const isPointInElement = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  if (
    (isLinearElement(element) || isFreeDrawElement(element)) &&
    !isPathALoop(element.points)
  ) {
    // There isn't any "inside" for a non-looping path
    return false;
  }

  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);

  if (!isPointWithinBounds(pointFrom(x1, y1), point, pointFrom(x2, y2))) {
    return false;
  }

  const center = pointFrom<GlobalPoint>((x1 + x2) / 2, (y1 + y2) / 2);
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
    elementsMap,
    intersector,
  ).filter((p, pos, arr) => arr.findIndex((q) => pointsEqual(q, p)) === pos);

  return intersections.length % 2 === 1;
};
