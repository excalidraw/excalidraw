import type { GlobalPoint, Radians } from "../../math";
import {
  curve,
  curvePointDistance,
  distanceToLineSegment,
  lineSegment,
  pointFrom,
  pointRotateRads,
  rectangle,
} from "../../math";
import { ellipse, ellipseDistanceFromPoint } from "../../math/ellipse";
import { getCornerRadius } from "../shapes";
import { getDiamondPoints } from "./bounds";
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
export const distanceToRectanguloidElement = (
  element: ExcalidrawRectanguloidElement,
  p: GlobalPoint,
) => {
  const r = rectangle(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width, element.y + element.height),
  );
  // To emulate a rotated rectangle we rotate the point in the inverse angle
  // instead. It's all the same distance-wise.
  const rotatedPoint = pointRotateRads(
    p,
    pointFrom(element.x + element.width / 2, element.y + element.height / 2),
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
  const sideDistances = [top, right, bottom, left].map((s) =>
    distanceToLineSegment(rotatedPoint, s),
  );
  const cornerDistances =
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
        ].map((a) => curvePointDistance(a, rotatedPoint))
      : [];

  return Math.min(...[...sideDistances, ...cornerDistances]);
};

/**
 * Returns the distance of a point and the provided diamond element, accounting
 * for roundness and rotation
 *
 * @param element The diamond element
 * @param p The point to consider
 * @returns The eucledian distance to the outline of the diamond
 */
export const distanceToDiamondElement = (
  element: ExcalidrawDiamondElement,
  p: GlobalPoint,
): number => {
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
  const rotatedPoint = pointRotateRads(p, center, -element.angle as Radians);
  const [top, right, bottom, left]: GlobalPoint[] = [
    pointFrom(element.x + topX, element.y + topY),
    pointFrom(element.x + rightX, element.y + rightY),
    pointFrom(element.x + bottomX, element.y + bottomY),
    pointFrom(element.x + leftX, element.y + leftY),
  ];

  // Create the line segment parts of the diamond
  // NOTE: Horizontal and vertical seems to be flipped here
  const topRight = lineSegment<GlobalPoint>(
    pointFrom(top[0] + verticalRadius, top[1] + horizontalRadius),
    pointFrom(right[0] + verticalRadius, right[1] + horizontalRadius),
  );
  const bottomRight = lineSegment<GlobalPoint>(
    pointFrom(bottom[0] + verticalRadius, bottom[1] + horizontalRadius),
    pointFrom(right[0] + verticalRadius, right[1] + horizontalRadius),
  );
  const bottomLeft = lineSegment<GlobalPoint>(
    pointFrom(bottom[0] + verticalRadius, bottom[1] + horizontalRadius),
    pointFrom(left[0] + verticalRadius, left[1] + horizontalRadius),
  );
  const topLeft = lineSegment<GlobalPoint>(
    pointFrom(top[0] + verticalRadius, top[1] + horizontalRadius),
    pointFrom(left[0] + verticalRadius, left[1] + horizontalRadius),
  );

  const curves = element.roundness
    ? [
        curve(topRight[1], right, right, bottomRight[1]), // RIGHT
        curve(bottomRight[0], bottom, bottom, bottomLeft[0]), // BOTTOM
        curve(bottomLeft[1], left, left, topLeft[1]), // LEFT
        curve(topLeft[0], top, top, topRight[0]), // LEFT
      ]
    : [];

  return Math.min(
    ...[
      ...[topRight, bottomRight, bottomLeft, topLeft].map((s) =>
        distanceToLineSegment(rotatedPoint, s),
      ),
      ...curves.map((a) => curvePointDistance(a, rotatedPoint)),
    ],
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
export const distanceToEllipseElement = (
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
