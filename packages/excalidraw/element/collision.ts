import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectangleElement,
  ExcalidrawRectanguloidElement,
} from "./types";
import { getDiamondPoints, getElementBounds } from "./bounds";
import type { FrameNameBounds } from "../types";
import type { GeometricShape } from "../../utils/geometry/shape";
import { getPolygonShape } from "../../utils/geometry/shape";
import { isPointInShape, isPointOnShape } from "../../utils/collision";
import { isTransparent } from "../utils";
import {
  hasBoundTextElement,
  isIframeLikeElement,
  isImageElement,
  isTextElement,
} from "./typeChecks";
import { getBoundTextShape, getCornerRadius, isPathALoop } from "../shapes";
import type {
  GlobalPoint,
  Line,
  LocalPoint,
  Polygon,
  Radians,
} from "../../math";
import {
  curve,
  curveIntersectLine,
  isPointWithinBounds,
  line,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
  pointRotateRads,
  pointsEqual,
  rectangle,
} from "../../math";
import { ellipse, ellipseLineIntersectionPoints } from "../../math/ellipse";

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
export const intersectElementWithLine = (
  element: ExcalidrawElement,
  line: Line<GlobalPoint>,
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
      return intersectRectanguloidWithLine(element, line, offset);
    case "diamond":
      return intersectDiamondWithLine(element, line, offset);
    case "ellipse":
      return intersectEllipseWithLine(element, line, offset);
    default:
      throw new Error(`Unimplemented element type '${element.type}'`);
  }
};

const intersectRectanguloidWithLine = (
  element: ExcalidrawRectanguloidElement,
  l: Line<GlobalPoint>,
  offset: number,
): GlobalPoint[] => {
  const r = rectangle(
    pointFrom(element.x - offset, element.y - offset),
    pointFrom(
      element.x + element.width + offset,
      element.y + element.height + offset,
    ),
  );
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
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );

  const top = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[0][0] + roundness, r[0][1]),
    pointFrom<GlobalPoint>(r[1][0] - roundness, r[0][1]),
  );
  const right = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[1][0], r[0][1] + roundness),
    pointFrom<GlobalPoint>(r[1][0], r[1][1] - roundness),
  );
  const bottom = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[0][0] + roundness, r[1][1]),
    pointFrom<GlobalPoint>(r[1][0] - roundness, r[1][1]),
  );
  const left = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[0][0], r[1][1] - roundness),
    pointFrom<GlobalPoint>(r[0][0], r[0][1] + roundness),
  );
  const sides = [top, right, bottom, left];
  const corners =
    roundness > 0
      ? [
          curve(
            left[1],
            pointFrom(
              left[1][0] + (2 / 3) * (r[0][0] - left[1][0]),
              left[1][1] + (2 / 3) * (r[0][1] - left[1][1]),
            ),
            pointFrom(
              top[0][0] + (2 / 3) * (r[0][0] - top[0][0]),
              top[0][1] + (2 / 3) * (r[0][1] - top[0][1]),
            ),
            top[0],
          ), // TOP LEFT
          curve(
            top[1],
            pointFrom(
              top[1][0] + (2 / 3) * (r[1][0] - top[1][0]),
              top[1][1] + (2 / 3) * (r[0][1] - top[1][1]),
            ),
            pointFrom(
              right[0][0] + (2 / 3) * (r[1][0] - right[0][0]),
              right[0][1] + (2 / 3) * (r[0][1] - right[0][1]),
            ),
            right[0],
          ), // TOP RIGHT
          curve(
            right[1],
            pointFrom(
              right[1][0] + (2 / 3) * (r[1][0] - right[1][0]),
              right[1][1] + (2 / 3) * (r[1][1] - right[1][1]),
            ),
            pointFrom(
              bottom[1][0] + (2 / 3) * (r[1][0] - bottom[1][0]),
              bottom[1][1] + (2 / 3) * (r[1][1] - bottom[1][1]),
            ),
            bottom[1],
          ), // BOTTOM RIGHT
          curve(
            bottom[0],
            pointFrom(
              bottom[0][0] + (2 / 3) * (r[0][0] - bottom[0][0]),
              bottom[0][1] + (2 / 3) * (r[1][1] - bottom[0][1]),
            ),
            pointFrom(
              left[0][0] + (2 / 3) * (r[0][0] - left[0][0]),
              left[0][1] + (2 / 3) * (r[1][1] - left[0][1]),
            ),
            left[0],
          ), // BOTTOM LEFT
        ]
      : [];

  const sideIntersections: GlobalPoint[] = sides
    .map((s) =>
      lineSegmentIntersectionPoints(line<GlobalPoint>(rotatedA, rotatedB), s),
    )
    .filter((x) => x != null)
    .map((j) => pointRotateRads<GlobalPoint>(j!, center, element.angle));

  const cornerIntersections: GlobalPoint[] = corners
    .flatMap((t) => curveIntersectLine(t, line(rotatedA, rotatedB)))
    .filter((i) => i != null)
    .map((j) => pointRotateRads(j, center, element.angle));

  return (
    [...sideIntersections, ...cornerIntersections]
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
const intersectDiamondWithLine = (
  element: ExcalidrawDiamondElement,
  l: Line<GlobalPoint>,
  offset: number = 0,
): GlobalPoint[] => {
  const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
    getDiamondPoints(element);
  const center = pointFrom<GlobalPoint>(
    (topX + bottomX) / 2,
    (topY + bottomY) / 2,
  );
  const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);
  const horizontalRadius = getCornerRadius(Math.abs(rightY - topY), element);

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  const [top, right, bottom, left]: GlobalPoint[] = [
    pointFrom(element.x + topX, element.y + topY - offset),
    pointFrom(element.x + rightX + offset, element.y + rightY),
    pointFrom(element.x + bottomX, element.y + bottomY + offset),
    pointFrom(element.x + leftX - offset, element.y + leftY),
  ];

  // Create the line segment parts of the diamond
  // NOTE: Horizontal and vertical seems to be flipped here
  const topRight = lineSegment<GlobalPoint>(
    pointFrom(top[0] + verticalRadius, top[1] + horizontalRadius),
    pointFrom(right[0] - verticalRadius, right[1] - horizontalRadius),
  );
  const bottomRight = lineSegment<GlobalPoint>(
    pointFrom(right[0] - verticalRadius, right[1] + horizontalRadius),
    pointFrom(bottom[0] + verticalRadius, bottom[1] - horizontalRadius),
  );
  const bottomLeft = lineSegment<GlobalPoint>(
    pointFrom(bottom[0] - verticalRadius, bottom[1] - horizontalRadius),
    pointFrom(left[0] + verticalRadius, left[1] + horizontalRadius),
  );
  const topLeft = lineSegment<GlobalPoint>(
    pointFrom(left[0] + verticalRadius, left[1] - horizontalRadius),
    pointFrom(top[0] - verticalRadius, top[1] + horizontalRadius),
  );

  const curves = element.roundness
    ? [
        curve(
          pointFrom<GlobalPoint>(
            right[0] - verticalRadius,
            right[1] - horizontalRadius,
          ),
          right,
          right,
          pointFrom<GlobalPoint>(
            right[0] - verticalRadius,
            right[1] + horizontalRadius,
          ),
        ), // RIGHT
        curve(
          pointFrom<GlobalPoint>(
            bottom[0] + verticalRadius,
            bottom[1] - horizontalRadius,
          ),
          bottom,
          bottom,
          pointFrom<GlobalPoint>(
            bottom[0] - verticalRadius,
            bottom[1] - horizontalRadius,
          ),
        ), // BOTTOM
        curve(
          pointFrom<GlobalPoint>(
            left[0] + verticalRadius,
            left[1] + horizontalRadius,
          ),
          left,
          left,
          pointFrom<GlobalPoint>(
            left[0] + verticalRadius,
            left[1] - horizontalRadius,
          ),
        ), // LEFT
        curve(
          pointFrom<GlobalPoint>(
            top[0] - verticalRadius,
            top[1] + horizontalRadius,
          ),
          top,
          top,
          pointFrom<GlobalPoint>(
            top[0] + verticalRadius,
            top[1] + horizontalRadius,
          ),
        ), // TOP
      ]
    : [];

  const sides: GlobalPoint[] = [topRight, bottomRight, bottomLeft, topLeft]
    .map((s) =>
      lineSegmentIntersectionPoints(line<GlobalPoint>(rotatedA, rotatedB), s),
    )
    .filter((p): p is GlobalPoint => p != null)
    // Rotate back intersection points
    .map((p) => pointRotateRads<GlobalPoint>(p!, center, element.angle));
  const corners = curves
    .flatMap((p) => curveIntersectLine(p, line(rotatedA, rotatedB)))
    .filter((p) => p != null)
    // Rotate back intersection points
    .map((p) => pointRotateRads(p, center, element.angle));

  return (
    [...sides, ...corners]
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
const intersectEllipseWithLine = (
  element: ExcalidrawEllipseElement,
  l: Line<GlobalPoint>,
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
