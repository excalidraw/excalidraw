import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawRectangleElement,
  ExcalidrawRectanguloidElement,
} from "./types";
import {
  createDiamondArc,
  createDiamondSide,
  getElementBounds,
} from "./bounds";
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
import {
  getBoundTextShape,
  getCornerRadius,
  getDiamondPoints,
} from "../shapes";
import type { Arc, GlobalPoint, Polygon } from "../../math";
import {
  pathIsALoop,
  isPointWithinBounds,
  point,
  rectangle,
  pointRotateRads,
  radians,
  segment,
  arc,
  lineSegmentIntersectionPoints,
  line,
  arcLineInterceptPoints,
  pointDistanceSq,
  ellipse,
  ellipseLineIntersectionPoints,
} from "../../math";
import { LINE_CONFIRM_THRESHOLD } from "../constants";

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
    return (
      isDraggableFromInside &&
      pathIsALoop(element.points, LINE_CONFIRM_THRESHOLD)
    );
  }

  if (element.type === "freedraw") {
    return (
      isDraggableFromInside &&
      pathIsALoop(element.points, LINE_CONFIRM_THRESHOLD)
    );
  }

  return isDraggableFromInside || isImageElement(element);
};

export type HitTestArgs = {
  sceneCoords: GlobalPoint;
  element: ExcalidrawElement;
  shape: GeometricShape<GlobalPoint>;
  threshold?: number;
  frameNameBound?: FrameNameBounds | null;
};

export const hitElementItself = ({
  sceneCoords,
  element,
  shape,
  threshold = 10,
  frameNameBound = null,
}: HitTestArgs) => {
  let hit = shouldTestInside(element)
    ? // Since `inShape` tests STRICTLY againt the insides of a shape
      // we would need `onShape` as well to include the "borders"
      isPointInShape(sceneCoords, shape) ||
      isPointOnShape(sceneCoords, shape, threshold)
    : isPointOnShape(sceneCoords, shape, threshold);

  // hit test against a frame's name
  if (!hit && frameNameBound) {
    hit = isPointInShape(sceneCoords, {
      type: "polygon",
      data: getPolygonShape(frameNameBound as ExcalidrawRectangleElement)
        .data as Polygon<GlobalPoint>,
    });
  }

  return hit;
};

export const hitElementBoundingBox = (
  scenePointer: GlobalPoint,
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  tolerance = 0,
) => {
  let [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  x1 -= tolerance;
  y1 -= tolerance;
  x2 += tolerance;
  y2 += tolerance;
  return isPointWithinBounds(point(x1, y1), scenePointer, point(x2, y2));
};

export const hitElementBoundingBoxOnly = (
  hitArgs: HitTestArgs,
  elementsMap: ElementsMap,
) => {
  return (
    !hitElementItself(hitArgs) &&
    // bound text is considered part of the element (even if it's outside the bounding box)
    !hitElementBoundText(
      hitArgs.sceneCoords,
      getBoundTextShape(hitArgs.element, elementsMap),
    ) &&
    hitElementBoundingBox(hitArgs.sceneCoords, hitArgs.element, elementsMap)
  );
};

export const hitElementBoundText = (
  scenePointer: GlobalPoint,
  textShape: GeometricShape<GlobalPoint> | null,
): boolean => {
  return !!textShape && isPointInShape(scenePointer, textShape);
};

export const intersectElementWithLine = (
  element: ExcalidrawElement,
  a: GlobalPoint,
  b: GlobalPoint,
  offset: number,
): GlobalPoint[] => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return intersectRectanguloidWithLine(element, a, b, offset);
    case "diamond":
      return intersectDiamondWithLine(element, a, b, offset);
    case "ellipse":
      return intersectEllipseWithLine(element, a, b, offset);
    default:
      throw new Error(`Unimplemented element type '${element.type}'`);
  }
};

export const intersectRectanguloidWithLine = (
  element: ExcalidrawRectanguloidElement,
  a: GlobalPoint,
  b: GlobalPoint,
  offset: number,
): GlobalPoint[] => {
  const r = rectangle(
    point(element.x - offset, element.y - offset),
    point(
      element.x + element.width + offset,
      element.y + element.height + offset,
    ),
  );
  const center = point<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedA = pointRotateRads<GlobalPoint>(
    a,
    center,
    radians(-element.angle),
  );
  const rotatedB = pointRotateRads<GlobalPoint>(
    b,
    center,
    radians(-element.angle),
  );
  const roundness = getCornerRadius(
    Math.min(element.width + 2 * offset, element.height + 2 * offset),
    element,
  );
  const sideIntersections: GlobalPoint[] = [
    segment<GlobalPoint>(
      point<GlobalPoint>(r[0][0] + roundness, r[0][1]),
      point<GlobalPoint>(r[1][0] - roundness, r[0][1]),
    ),
    segment<GlobalPoint>(
      point<GlobalPoint>(r[1][0], r[0][1] + roundness),
      point<GlobalPoint>(r[1][0], r[1][1] - roundness),
    ),
    segment<GlobalPoint>(
      point<GlobalPoint>(r[1][0] - roundness, r[1][1]),
      point<GlobalPoint>(r[0][0] + roundness, r[1][1]),
    ),
    segment<GlobalPoint>(
      point<GlobalPoint>(r[0][0], r[1][1] - roundness),
      point<GlobalPoint>(r[0][0], r[0][1] + roundness),
    ),
  ]
    .map((s) =>
      lineSegmentIntersectionPoints(line<GlobalPoint>(rotatedA, rotatedB), s),
    )
    .filter((x) => x != null)
    .map((j) => pointRotateRads<GlobalPoint>(j, center, element.angle));
  const cornerIntersections: GlobalPoint[] =
    roundness > 0
      ? [
          arc<GlobalPoint>(
            point(r[0][0] + roundness, r[0][1] + roundness),
            roundness,
            radians(Math.PI),
            radians((3 / 4) * Math.PI),
          ),
          arc<GlobalPoint>(
            point(r[1][0] - roundness, r[0][1] + roundness),
            roundness,
            radians((3 / 4) * Math.PI),
            radians(0),
          ),
          arc<GlobalPoint>(
            point(r[1][0] - roundness, r[1][1] - roundness),
            roundness,
            radians(0),
            radians((1 / 2) * Math.PI),
          ),
          arc<GlobalPoint>(
            point(r[0][0] + roundness, r[1][1] - roundness),
            roundness,
            radians((1 / 2) * Math.PI),
            radians(Math.PI),
          ),
        ]
          .flatMap((t) => arcLineInterceptPoints(t, line(rotatedA, rotatedB)))
          .filter((i) => i != null)
          .map((j) => pointRotateRads(j, center, element.angle))
      : [];

  return [...sideIntersections, ...cornerIntersections].sort(
    (g, h) => pointDistanceSq(g!, b) - pointDistanceSq(h!, b),
  );
};

/**
 *
 * @param element
 * @param a
 * @param b
 * @returns
 */
export const intersectDiamondWithLine = (
  element: ExcalidrawDiamondElement,
  a: GlobalPoint,
  b: GlobalPoint,
  offset: number = 0,
): GlobalPoint[] => {
  const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
    getDiamondPoints(element, offset);
  const center = point<GlobalPoint>((topX + bottomX) / 2, (topY + bottomY) / 2);
  const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);
  const horizontalRadius = getCornerRadius(Math.abs(rightY - topY), element);

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedA = pointRotateRads(a, center, radians(-element.angle));
  const rotatedB = pointRotateRads(b, center, radians(-element.angle));
  const [top, right, bottom, left]: GlobalPoint[] = [
    point(element.x + topX, element.y + topY),
    point(element.x + rightX, element.y + rightY),
    point(element.x + bottomX, element.y + bottomY),
    point(element.x + leftX, element.y + leftY),
  ];

  const topRight = createDiamondSide(
    segment<GlobalPoint>(top, right),
    verticalRadius,
    horizontalRadius,
  );
  const bottomRight = createDiamondSide(
    segment<GlobalPoint>(bottom, right),
    verticalRadius,
    horizontalRadius,
  );
  const bottomLeft = createDiamondSide(
    segment<GlobalPoint>(bottom, left),
    verticalRadius,
    horizontalRadius,
  );
  const topLeft = createDiamondSide(
    segment<GlobalPoint>(top, left),
    verticalRadius,
    horizontalRadius,
  );

  const arcs: Arc<GlobalPoint>[] = element.roundness
    ? [
        createDiamondArc(topLeft[0], topRight[0], verticalRadius), // TOP
        createDiamondArc(topRight[1], bottomRight[1], horizontalRadius), // RIGHT
        createDiamondArc(bottomRight[0], bottomLeft[0], verticalRadius), // BOTTOM
        createDiamondArc(bottomLeft[1], topLeft[1], horizontalRadius), // LEFT
      ]
    : [];

  const sides: GlobalPoint[] = [topRight, bottomRight, bottomLeft, topLeft]
    .map((s) =>
      lineSegmentIntersectionPoints(line<GlobalPoint>(rotatedA, rotatedB), s),
    )
    .filter((x) => x != null)
    // Rotate back intersection points
    .map((p) => pointRotateRads<GlobalPoint>(p, center, element.angle));
  const corners = arcs
    .flatMap((x) => arcLineInterceptPoints(x, line(rotatedA, rotatedB)))
    .filter((x) => x != null)
    // Rotate back intersection points
    .map((p) => pointRotateRads(p, center, element.angle));

  return [...sides, ...corners].sort(
    (g, h) => pointDistanceSq(g!, b) - pointDistanceSq(h!, b),
  );
};

/**
 *
 * @param element
 * @param a
 * @param b
 * @returns
 */
export const intersectEllipseWithLine = (
  element: ExcalidrawEllipseElement,
  a: GlobalPoint,
  b: GlobalPoint,
  offset: number = 0,
): GlobalPoint[] => {
  const center = point<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  const rotatedA = pointRotateRads(a, center, radians(-element.angle));
  const rotatedB = pointRotateRads(b, center, radians(-element.angle));

  return ellipseLineIntersectionPoints(
    ellipse(center, element.width / 2 + offset, element.height / 2 + offset),
    line(rotatedA, rotatedB),
  ).map((p) => pointRotateRads(p, center, element.angle));
};
