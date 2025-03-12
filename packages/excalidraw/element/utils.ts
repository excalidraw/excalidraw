import {
  curve,
  lineSegment,
  pointFrom,
  pointFromVector,
  rectangle,
  vectorFromPoint,
  vectorNormalize,
  vectorScale,
  type GlobalPoint,
} from "@excalidraw/math";

import type { Curve, LineSegment } from "@excalidraw/math";

import { getCornerRadius } from "../shapes";

import { getDiamondPoints } from ".";

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
export function deconstructRectanguloidElement(
  element: ExcalidrawRectanguloidElement,
  offset: number = 0,
): [LineSegment<GlobalPoint>[], Curve<GlobalPoint>[]] {
  const roundness = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );

  if (roundness <= 0) {
    const r = rectangle(
      pointFrom(element.x - offset, element.y - offset),
      pointFrom(
        element.x + element.width + offset,
        element.y + element.height + offset,
      ),
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

    return [sides, []];
  }

  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  const r = rectangle(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width, element.y + element.height),
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

  const offsets = [
    vectorScale(
      vectorNormalize(
        vectorFromPoint(pointFrom(r[0][0] - offset, r[0][1] - offset), center),
      ),
      offset,
    ), // TOP LEFT
    vectorScale(
      vectorNormalize(
        vectorFromPoint(pointFrom(r[1][0] + offset, r[0][1] - offset), center),
      ),
      offset,
    ), //TOP RIGHT
    vectorScale(
      vectorNormalize(
        vectorFromPoint(pointFrom(r[1][0] + offset, r[1][1] + offset), center),
      ),
      offset,
    ), // BOTTOM RIGHT
    vectorScale(
      vectorNormalize(
        vectorFromPoint(pointFrom(r[0][0] - offset, r[1][1] + offset), center),
      ),
      offset,
    ), // BOTTOM LEFT
  ];

  const corners = [
    curve(
      pointFromVector(offsets[0], left[1]),
      pointFromVector(
        offsets[0],
        pointFrom<GlobalPoint>(
          left[1][0] + (2 / 3) * (r[0][0] - left[1][0]),
          left[1][1] + (2 / 3) * (r[0][1] - left[1][1]),
        ),
      ),
      pointFromVector(
        offsets[0],
        pointFrom<GlobalPoint>(
          top[0][0] + (2 / 3) * (r[0][0] - top[0][0]),
          top[0][1] + (2 / 3) * (r[0][1] - top[0][1]),
        ),
      ),
      pointFromVector(offsets[0], top[0]),
    ), // TOP LEFT
    curve(
      pointFromVector(offsets[1], top[1]),
      pointFromVector(
        offsets[1],
        pointFrom<GlobalPoint>(
          top[1][0] + (2 / 3) * (r[1][0] - top[1][0]),
          top[1][1] + (2 / 3) * (r[0][1] - top[1][1]),
        ),
      ),
      pointFromVector(
        offsets[1],
        pointFrom<GlobalPoint>(
          right[0][0] + (2 / 3) * (r[1][0] - right[0][0]),
          right[0][1] + (2 / 3) * (r[0][1] - right[0][1]),
        ),
      ),
      pointFromVector(offsets[1], right[0]),
    ), // TOP RIGHT
    curve(
      pointFromVector(offsets[2], right[1]),
      pointFromVector(
        offsets[2],
        pointFrom<GlobalPoint>(
          right[1][0] + (2 / 3) * (r[1][0] - right[1][0]),
          right[1][1] + (2 / 3) * (r[1][1] - right[1][1]),
        ),
      ),
      pointFromVector(
        offsets[2],
        pointFrom<GlobalPoint>(
          bottom[1][0] + (2 / 3) * (r[1][0] - bottom[1][0]),
          bottom[1][1] + (2 / 3) * (r[1][1] - bottom[1][1]),
        ),
      ),
      pointFromVector(offsets[2], bottom[1]),
    ), // BOTTOM RIGHT
    curve(
      pointFromVector(offsets[3], bottom[0]),
      pointFromVector(
        offsets[3],
        pointFrom<GlobalPoint>(
          bottom[0][0] + (2 / 3) * (r[0][0] - bottom[0][0]),
          bottom[0][1] + (2 / 3) * (r[1][1] - bottom[0][1]),
        ),
      ),
      pointFromVector(
        offsets[3],
        pointFrom<GlobalPoint>(
          left[0][0] + (2 / 3) * (r[0][0] - left[0][0]),
          left[0][1] + (2 / 3) * (r[1][1] - left[0][1]),
        ),
      ),
      pointFromVector(offsets[3], left[0]),
    ), // BOTTOM LEFT
  ];

  const sides = [
    lineSegment<GlobalPoint>(corners[0][3], corners[1][0]),
    lineSegment<GlobalPoint>(corners[1][3], corners[2][0]),
    lineSegment<GlobalPoint>(corners[2][3], corners[3][0]),
    lineSegment<GlobalPoint>(corners[3][3], corners[0][0]),
  ];

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

  if (element.roundness?.type == null) {
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

    return [[topRight, bottomRight, bottomLeft, topLeft], []];
  }

  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );

  const [top, right, bottom, left]: GlobalPoint[] = [
    pointFrom(element.x + topX, element.y + topY),
    pointFrom(element.x + rightX, element.y + rightY),
    pointFrom(element.x + bottomX, element.y + bottomY),
    pointFrom(element.x + leftX, element.y + leftY),
  ];

  const offsets = [
    vectorScale(vectorNormalize(vectorFromPoint(right, center)), offset), // RIGHT
    vectorScale(vectorNormalize(vectorFromPoint(bottom, center)), offset), // BOTTOM
    vectorScale(vectorNormalize(vectorFromPoint(left, center)), offset), // LEFT
    vectorScale(vectorNormalize(vectorFromPoint(top, center)), offset), // TOP
  ];

  const corners = [
    curve(
      pointFromVector(
        offsets[0],
        pointFrom<GlobalPoint>(
          right[0] - verticalRadius,
          right[1] - horizontalRadius,
        ),
      ),
      pointFromVector(offsets[0], right),
      pointFromVector(offsets[0], right),
      pointFromVector(
        offsets[0],
        pointFrom<GlobalPoint>(
          right[0] - verticalRadius,
          right[1] + horizontalRadius,
        ),
      ),
    ), // RIGHT
    curve(
      pointFromVector(
        offsets[1],
        pointFrom<GlobalPoint>(
          bottom[0] + verticalRadius,
          bottom[1] - horizontalRadius,
        ),
      ),
      pointFromVector(offsets[1], bottom),
      pointFromVector(offsets[1], bottom),
      pointFromVector(
        offsets[1],
        pointFrom<GlobalPoint>(
          bottom[0] - verticalRadius,
          bottom[1] - horizontalRadius,
        ),
      ),
    ), // BOTTOM
    curve(
      pointFromVector(
        offsets[2],
        pointFrom<GlobalPoint>(
          left[0] + verticalRadius,
          left[1] + horizontalRadius,
        ),
      ),
      pointFromVector(offsets[2], left),
      pointFromVector(offsets[2], left),
      pointFromVector(
        offsets[2],
        pointFrom<GlobalPoint>(
          left[0] + verticalRadius,
          left[1] - horizontalRadius,
        ),
      ),
    ), // LEFT
    curve(
      pointFromVector(
        offsets[3],
        pointFrom<GlobalPoint>(
          top[0] - verticalRadius,
          top[1] + horizontalRadius,
        ),
      ),
      pointFromVector(offsets[3], top),
      pointFromVector(offsets[3], top),
      pointFromVector(
        offsets[3],
        pointFrom<GlobalPoint>(
          top[0] + verticalRadius,
          top[1] + horizontalRadius,
        ),
      ),
    ), // TOP
  ];

  const sides = [
    lineSegment<GlobalPoint>(corners[0][3], corners[1][0]),
    lineSegment<GlobalPoint>(corners[1][3], corners[2][0]),
    lineSegment<GlobalPoint>(corners[2][3], corners[3][0]),
    lineSegment<GlobalPoint>(corners[3][3], corners[0][0]),
  ];

  return [sides, corners];
}
