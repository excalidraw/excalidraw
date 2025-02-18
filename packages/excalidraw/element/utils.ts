import { getDiamondPoints } from ".";
import type { Curve, LineSegment } from "../../math";
import {
  curve,
  lineSegment,
  pointFrom,
  rectangle,
  type GlobalPoint,
  type LocalPoint,
} from "../../math";
import { getCornerRadius } from "../shapes";
import type {
  ExcalidrawDiamondElement,
  ExcalidrawRectanguloidElement,
} from "./types";

/**
 * Get the building components of a rectanguloid element in the form of
 * line segments and curves.
 *
 * @param element Target rectanguloid element
 * @param offset Optional offset to expand the rectanguloid shape
 * @returns Tuple of line segments (0) and curves (1)
 */
export function deconstructRectanguloidElement<
  Point extends GlobalPoint | LocalPoint,
>(
  element: ExcalidrawRectanguloidElement,
): [LineSegment<Point>[], Curve<Point>[]] {
  const r = rectangle(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width, element.y + element.height),
  );
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );

  const top = lineSegment<Point>(
    pointFrom<Point>(r[0][0] + roundness, r[0][1]),
    pointFrom<Point>(r[1][0] - roundness, r[0][1]),
  );
  const right = lineSegment<Point>(
    pointFrom<Point>(r[1][0], r[0][1] + roundness),
    pointFrom<Point>(r[1][0], r[1][1] - roundness),
  );
  const bottom = lineSegment<Point>(
    pointFrom<Point>(r[0][0] + roundness, r[1][1]),
    pointFrom<Point>(r[1][0] - roundness, r[1][1]),
  );
  const left = lineSegment<Point>(
    pointFrom<Point>(r[0][0], r[1][1] - roundness),
    pointFrom<Point>(r[0][0], r[0][1] + roundness),
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

  return [sides, corners];
}

/**
 * Get the building components of a diamond element in the form of
 * line segments and curves as a tuple, in this order.
 *
 * @param element The element to deconstruct
 * @param offset An optional offset
 * @returns Tuple of line segments (0) and curves (1)
 */
export function deconstructDiamondElement(
  element: ExcalidrawDiamondElement,
  offset: number = 0,
): [LineSegment<GlobalPoint>[], Curve<GlobalPoint>[]] {
  const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
    getDiamondPoints(element);
  const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);
  const horizontalRadius = getCornerRadius(Math.abs(rightY - topY), element);

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

  return [[topRight, bottomRight, bottomLeft, topLeft], curves];
}
