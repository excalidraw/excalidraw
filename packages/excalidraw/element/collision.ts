import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectangleElement,
  ExcalidrawRectanguloidElement,
} from "./types";
import { getElementBounds } from "./bounds";
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
  Arc,
  GlobalPoint,
  Line,
  LocalPoint,
  Polygon,
  Radians,
} from "../../math";
import {
  arc,
  arcLineInterceptPoints,
  isPointWithinBounds,
  line,
  lineSegment,
  lineSegmentIntersectionPoints,
  pointDistanceSq,
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
    Math.min(element.width + 2 * offset, element.height + 2 * offset),
    element,
  );

  const sideIntersections: GlobalPoint[] = [
    lineSegment<GlobalPoint>(
      pointFrom<GlobalPoint>(r[0][0] + roundness, r[0][1]),
      pointFrom<GlobalPoint>(r[1][0] - roundness, r[0][1]),
    ),
    lineSegment<GlobalPoint>(
      pointFrom<GlobalPoint>(r[1][0], r[0][1] + roundness),
      pointFrom<GlobalPoint>(r[1][0], r[1][1] - roundness),
    ),
    lineSegment<GlobalPoint>(
      pointFrom<GlobalPoint>(r[1][0] - roundness, r[1][1]),
      pointFrom<GlobalPoint>(r[0][0] + roundness, r[1][1]),
    ),
    lineSegment<GlobalPoint>(
      pointFrom<GlobalPoint>(r[0][0], r[1][1] - roundness),
      pointFrom<GlobalPoint>(r[0][0], r[0][1] + roundness),
    ),
  ]
    .map((s) =>
      lineSegmentIntersectionPoints(line<GlobalPoint>(rotatedA, rotatedB), s),
    )
    .filter((x) => x != null)
    .map((j) => pointRotateRads<GlobalPoint>(j!, center, element.angle));
  const cornerIntersections: GlobalPoint[] =
    roundness > 0
      ? [
          arc<GlobalPoint>(
            pointFrom(r[0][0] + roundness, r[0][1] + roundness),
            roundness,
            ((3 / 4) * Math.PI) as Radians,
            0 as Radians,
          ),
          arc<GlobalPoint>(
            pointFrom(r[1][0] - roundness, r[0][1] + roundness),
            roundness,
            ((3 / 4) * Math.PI) as Radians,
            0 as Radians,
          ),
          arc<GlobalPoint>(
            pointFrom(r[1][0] - roundness, r[1][1] - roundness),
            roundness,
            0 as Radians,
            ((1 / 2) * Math.PI) as Radians,
          ),
          arc<GlobalPoint>(
            pointFrom(r[0][0] + roundness, r[1][1] - roundness),
            roundness,
            ((1 / 2) * Math.PI) as Radians,
            Math.PI as Radians,
          ),
        ]
          .flatMap((t) => arcLineInterceptPoints(t, line(rotatedA, rotatedB)))
          .filter((i) => i != null)
          .map((j) => pointRotateRads(j, center, element.angle))
      : [];

  return (
    [...sideIntersections, ...cornerIntersections]
      // Remove duplicates
      .filter(
        (p, idx, points) => points.findIndex((d) => pointsEqual(p, d)) === idx,
      )
      .sort((g, h) => pointDistanceSq(g!, l[0]) - pointDistanceSq(h!, l[1]))
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
  const top = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y - offset,
  );
  const right = pointFrom<GlobalPoint>(
    element.x + element.width + offset,
    element.y + element.height / 2,
  );
  const bottom = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height + offset,
  );
  const left = pointFrom<GlobalPoint>(
    element.x - offset,
    element.y + element.height / 2,
  );
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const verticalRadius = getCornerRadius(Math.abs(top[0] - left[0]), element);
  const horizontalRadius = getCornerRadius(
    Math.abs(right[1] - top[1]),
    element,
  );

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedA = pointRotateRads(l[0], center, -element.angle as Radians);
  const rotatedB = pointRotateRads(l[1], center, -element.angle as Radians);

  const topRight = lineSegment<GlobalPoint>(
    pointFrom(top[0] + verticalRadius, top[1] + horizontalRadius),
    pointFrom(right[0] - verticalRadius, right[1] - horizontalRadius),
  );
  const bottomRight = lineSegment<GlobalPoint>(
    pointFrom(bottom[0] + verticalRadius, bottom[1] - horizontalRadius),
    pointFrom(right[0] - verticalRadius, right[1] + horizontalRadius),
  );
  const bottomLeft = lineSegment<GlobalPoint>(
    pointFrom(bottom[0] - verticalRadius, bottom[1] - horizontalRadius),
    pointFrom(left[0] + verticalRadius, left[1] + horizontalRadius),
  );
  const topLeft = lineSegment<GlobalPoint>(
    pointFrom(top[0] - verticalRadius, top[1] + horizontalRadius),
    pointFrom(left[0] + verticalRadius, left[1] - horizontalRadius),
  );

  const arcs: Arc<GlobalPoint>[] = element.roundness
    ? [
        createDiamondArc(
          topLeft[0],
          topRight[0],
          pointFrom(
            top[0],
            top[1] + Math.sqrt(2 * Math.pow(verticalRadius, 2)) - offset,
          ),
          verticalRadius,
        ), // TOP
        createDiamondArc(
          topRight[1],
          bottomRight[1],
          pointFrom(
            right[0] - Math.sqrt(2 * Math.pow(horizontalRadius, 2)) + offset,
            right[1],
          ),
          horizontalRadius,
        ), // RIGHT
        createDiamondArc(
          bottomRight[0],
          bottomLeft[0],
          pointFrom(
            bottom[0],
            bottom[1] - Math.sqrt(2 * Math.pow(verticalRadius, 2)) + offset,
          ),
          verticalRadius,
        ), // BOTTOM
        createDiamondArc(
          bottomLeft[1],
          topLeft[1],
          pointFrom(
            left[0] + Math.sqrt(2 * Math.pow(horizontalRadius, 2)) - offset,
            left[1],
          ),
          horizontalRadius,
        ), // LEFT
      ]
    : [];

  const sides: GlobalPoint[] = [topRight, bottomRight, bottomLeft, topLeft]
    .map((s) =>
      lineSegmentIntersectionPoints(line<GlobalPoint>(rotatedA, rotatedB), s),
    )
    .filter((x) => x != null)
    // Rotate back intersection points
    .map((p) => pointRotateRads<GlobalPoint>(p!, center, element.angle));
  const corners = arcs
    .flatMap((x) => arcLineInterceptPoints(x, line(rotatedA, rotatedB)))
    .filter((x) => x != null)
    // Rotate back intersection points
    .map((p) => pointRotateRads(p, center, element.angle));

  return (
    [...sides, ...corners]
      // Remove duplicates
      .filter(
        (p, idx, points) => points.findIndex((d) => pointsEqual(p, d)) === idx,
      )
      .sort((g, h) => pointDistanceSq(g!, l[0]) - pointDistanceSq(h!, l[1]))
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
  )
    .map((p) => pointRotateRads(p, center, element.angle))
    .sort((g, h) => pointDistanceSq(g!, l[0]) - pointDistanceSq(h!, l[1]));
};
