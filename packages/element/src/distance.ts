import {
  curvePointDistance,
  distanceToLineSegment,
  lineSegment,
  pointDistance,
  pointFrom,
  pointRotateRads,
  polygonIncludesPointNonZero,
} from "@excalidraw/math";

import { ellipse, ellipseDistanceFromPoint } from "@excalidraw/math/ellipse";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import {
  deconstructDiamondElement,
  deconstructLinearOrFreeDrawElement,
  deconstructRectanguloidElement,
} from "./utils";

import {
  elementCenterPoint,
  getArrowheadAnchorOnCurve,
  getArrowheadPointsAt,
} from "./bounds";
import { getArrowheadParts } from "./arrowheads";
import { isElbowArrow } from "./typeChecks";

import type { ArrowheadPart } from "./arrowheads";

import type {
  ElementsMap,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectanguloidElement,
} from "./types";

export const distanceToElement = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
): number => {
  switch (element.type) {
    case "selection":
    case "rectangle":
    case "stickynote":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return distanceToRectanguloidElement(element, elementsMap, p);
    case "diamond":
      return distanceToDiamondElement(element, elementsMap, p);
    case "ellipse":
      return distanceToEllipseElement(element, elementsMap, p);
    case "line":
    case "arrow":
      return distanceToLinearOrFreeDraElement(element, elementsMap, p);
    case "freedraw":
      return distanceToFreeDrawElement(element, elementsMap, p);
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
  elementsMap: ElementsMap,
  p: GlobalPoint,
) => {
  const center = elementCenterPoint(element, elementsMap);
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(p, center, -element.angle as Radians);

  // Get the element's building components we can test against
  const [sides, corners] = deconstructRectanguloidElement(element);

  return Math.min(
    ...sides.map((s) => distanceToLineSegment(rotatedPoint, s)),
    ...corners.map((a) => curvePointDistance(a, rotatedPoint)),
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
  elementsMap: ElementsMap,
  p: GlobalPoint,
): number => {
  const center = elementCenterPoint(element, elementsMap);

  // Rotate the point to the inverse direction to simulate the rotated diamond
  // points. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(p, center, -element.angle as Radians);

  const [sides, curves] = deconstructDiamondElement(element);

  return Math.min(
    ...sides.map((s) => distanceToLineSegment(rotatedPoint, s)),
    ...curves.map((a) => curvePointDistance(a, rotatedPoint)),
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
  elementsMap: ElementsMap,
  p: GlobalPoint,
): number => {
  const center = elementCenterPoint(element, elementsMap);
  return ellipseDistanceFromPoint(
    // Instead of rotating the ellipse, rotate the point to the inverse angle
    pointRotateRads(p, center, -element.angle as Radians),
    ellipse(center, element.width / 2, element.height / 2),
  );
};

const distanceToLinearOrFreeDraElement = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
) => {
  const [lines, curves] = deconstructLinearOrFreeDrawElement(
    element,
    elementsMap,
  );
  return Math.min(
    ...lines.map((s) => distanceToLineSegment(p, s)),
    ...curves.map((a) => curvePointDistance(a, p)),
    element.type === "arrow"
      ? distanceToArrowheads(element, elementsMap, p)
      : Infinity,
  );
};

const arrowheadsCollisionCache = new WeakMap<
  ExcalidrawLinearElement,
  { version: number; parts: ArrowheadPart<GlobalPoint>[] }
>();

/**
 * The parts of an arrow's arrowheads in (rotated) scene coordinates, placed
 * on the arrow's path rather than on its rough shape.
 */
export const getArrowheadsCollisionParts = (
  element: ExcalidrawLinearElement,
  elementsMap: ElementsMap,
): ArrowheadPart<GlobalPoint>[] => {
  const cached = arrowheadsCollisionCache.get(element);
  if (cached?.version === element.version) {
    return cached.parts;
  }

  const parts: ArrowheadPart<GlobalPoint>[] = [];
  const { points } = element;

  if (points.length > 1) {
    const center = elementCenterPoint(element, elementsMap);
    const toScene = (point: LocalPoint) =>
      pointRotateRads(
        pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
        center,
        element.angle,
      );
    // curved arrowheads point along the curve's end, like when rendered
    const curves =
      element.roundness && !isElbowArrow(element)
        ? deconstructLinearOrFreeDrawElement(element, elementsMap)[1]
        : [];

    for (const position of ["start", "end"] as const) {
      const arrowhead =
        position === "start" ? element.startArrowhead : element.endArrowhead;
      if (!arrowhead) {
        continue;
      }

      const [tip, prev] = (
        position === "start"
          ? [points[0], points[1]]
          : [points[points.length - 1], points[points.length - 2]]
      ).map(toScene);
      const curve = position === "start" ? curves[0] : curves.at(-1);
      const anchor = curve
        ? getArrowheadAnchorOnCurve(curve, position, prev)
        : { tip, along: prev, prev };

      parts.push(
        ...getArrowheadParts<GlobalPoint>(arrowhead, (part, offsetMultiplier) =>
          getArrowheadPointsAt(
            element,
            position,
            part,
            anchor,
            offsetMultiplier,
          ),
        ),
      );
    }
  }

  arrowheadsCollisionCache.set(element, { version: element.version, parts });

  return parts;
};

/**
 * @returns 0 inside filled arrowheads
 */
const distanceToArrowheads = (
  element: ExcalidrawLinearElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
) => {
  let distance = Infinity;

  for (const part of getArrowheadsCollisionParts(element, elementsMap)) {
    switch (part.type) {
      case "line":
        distance = Math.min(
          distance,
          distanceToLineSegment(p, lineSegment(part.start, part.end)),
        );
        break;
      case "circle":
        distance = Math.min(
          distance,
          Math.max(0, pointDistance(p, part.center) - part.diameter / 2),
        );
        break;
      case "polygon":
        if (polygonIncludesPointNonZero(p, part.points)) {
          return 0;
        }
        for (let i = 0; i < part.points.length; i++) {
          distance = Math.min(
            distance,
            distanceToLineSegment(
              p,
              lineSegment(
                part.points[i],
                part.points[(i + 1) % part.points.length],
              ),
            ),
          );
        }
        break;
    }
  }

  return distance;
};

/**
 * Returns the distance of a point to a freedraw element.
 *
 * @param element The freedraw element
 * @param p The point to consider
 * @returns 0 if the point is within the inked area, otherwise the euclidean
 * distance to the stroke outline
 */
const distanceToFreeDrawElement = (
  element: ExcalidrawFreeDrawElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
) => {
  const [lines] = deconstructLinearOrFreeDrawElement(element, elementsMap);

  if (lines.length === 0) {
    return Infinity;
  }

  const polygon = lines.map((line) => line[0]);
  if (polygonIncludesPointNonZero(p, polygon)) {
    return 0;
  }

  return Math.min(...lines.map((s) => distanceToLineSegment(p, s)));
};
