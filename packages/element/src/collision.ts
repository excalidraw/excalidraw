import { simplify } from "points-on-curve";

import { RoughGenerator } from "roughjs/bin/generator";

import {
  isTransparent,
  elementCenterPoint,
  arrayToMap,
} from "@excalidraw/common";
import {
  curveIntersectLineSegment,
  isCurve,
  isLineSegment,
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
  curve,
  curveCatmullRomCubicApproxPoints,
  curveOffsetPoints,
  pointFromArray,
  rectangle,
  ellipse,
  ellipseSegmentInterceptPoints,
} from "@excalidraw/math";

import type {
  Curve,
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Radians,
} from "@excalidraw/math";
import type { FrameNameBounds } from "@excalidraw/excalidraw/types";

import { getCornerRadius, isPathALoop } from "./shapes";
import { getDiamondPoints, getElementBounds } from "./bounds";
import { getBoundTextElement } from "./textElement";
import { LinearElementEditor } from "./linearElementEditor";
import { distanceToElement } from "./distance";
import { generateElbowArrowRougJshPathCommands } from "./utils";

import {
  hasBoundTextElement,
  isElbowArrow,
  isFreeDrawElement,
  isIframeLikeElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";

import type { Options } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";

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
        isPointInElement(point, element) ||
        isPointOnElementOutline(point, element, threshold)
      : isPointOnElementOutline(point, element, threshold)
    : false;

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

  return isPointInElement(point, boundTextElement);
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
      return intersectLinearOrFreeDrawWithLineSegment(element, line);
  }
};

const intersectLinearOrFreeDrawWithLineSegment = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
  segment: LineSegment<GlobalPoint>,
): GlobalPoint[] => {
  const shapes = deconstructLinearOrFreeDrawElementForCollision(element);
  const intersections: GlobalPoint[] = [];

  for (const shape of shapes) {
    switch (true) {
      case isCurve(shape):
        intersections.push(
          ...curveIntersectLineSegment(shape as Curve<GlobalPoint>, segment),
        );
        continue;
      case isLineSegment(shape):
        const point = lineSegmentIntersectionPoints(
          segment,
          shape as LineSegment<GlobalPoint>,
        );

        if (point) {
          intersections.push(point);
        }

        continue;
    }
  }

  return intersections;
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
  const [sides, corners] = deconstructRectanguloidElementForCollision(
    element,
    offset,
  );

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

  const [sides, curves] = deconstructDiamondElementForCollision(
    element,
    offset,
  );

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

// check if the given point is considered on the given shape's border
const isPointOnElementOutline = (
  point: GlobalPoint,
  element: ExcalidrawElement,
  tolerance = 1,
) => distanceToElement(element, point) <= tolerance;

// check if the given point is considered inside the element's border
export const isPointInElement = (
  point: GlobalPoint,
  element: ExcalidrawElement,
) => {
  if (
    (isLinearElement(element) || isFreeDrawElement(element)) &&
    !isPathALoop(element.points)
  ) {
    // There isn't any "inside" for a non-looping path
    return false;
  }

  const [x1, y1, x2, y2] = getElementBounds(element, new Map());
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
    intersector,
  ).filter((item, pos, arr) => arr.indexOf(item) === pos);

  return intersections.length % 2 === 1;
};

export function deconstructLinearOrFreeDrawElementForCollision(
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
): (Curve<GlobalPoint> | LineSegment<GlobalPoint>)[] {
  const ops = generateLinearShapesForCollision(element) as {
    op: string;
    data: number[];
  }[];
  const components = [];

  for (let idx = 0; idx < ops.length; idx += 1) {
    const op = ops[idx];
    const prevPoint =
      ops[idx - 1] && pointFromArray<LocalPoint>(ops[idx - 1].data.slice(-2));
    switch (op.op) {
      case "move":
        continue;
      case "lineTo":
        if (!prevPoint) {
          throw new Error("prevPoint is undefined");
        }

        components.push(
          lineSegment<GlobalPoint>(
            pointFrom<GlobalPoint>(
              element.x + prevPoint[0],
              element.y + prevPoint[1],
            ),
            pointFrom<GlobalPoint>(
              element.x + op.data[0],
              element.y + op.data[1],
            ),
          ),
        );
        continue;
      case "bcurveTo":
        if (!prevPoint) {
          throw new Error("prevPoint is undefined");
        }

        components.push(
          curve<GlobalPoint>(
            pointFrom<GlobalPoint>(
              element.x + prevPoint[0],
              element.y + prevPoint[1],
            ),
            pointFrom<GlobalPoint>(
              element.x + op.data[0],
              element.y + op.data[1],
            ),
            pointFrom<GlobalPoint>(
              element.x + op.data[2],
              element.y + op.data[3],
            ),
            pointFrom<GlobalPoint>(
              element.x + op.data[4],
              element.y + op.data[5],
            ),
          ),
        );
        continue;
      default: {
        console.error("Unknown op type", op.op);
      }
    }
  }

  return components;
}

/**
 * Get the building components of a rectanguloid element in the form of
 * line segments and curves.
 *
 * @param element Target rectanguloid element
 * @param offset Optional offset to expand the rectanguloid shape
 * @returns Tuple of line segments (0) and curves (1)
 */
export function deconstructRectanguloidElementForCollision(
  element: ExcalidrawRectanguloidElement,
  offset: number = 0,
): [LineSegment<GlobalPoint>[], Curve<GlobalPoint>[]] {
  let radius = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );

  if (radius === 0) {
    radius = 0.01;
  }

  const r = rectangle(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width, element.y + element.height),
  );

  const top = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[0][0] + radius, r[0][1]),
    pointFrom<GlobalPoint>(r[1][0] - radius, r[0][1]),
  );
  const right = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[1][0], r[0][1] + radius),
    pointFrom<GlobalPoint>(r[1][0], r[1][1] - radius),
  );
  const bottom = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[0][0] + radius, r[1][1]),
    pointFrom<GlobalPoint>(r[1][0] - radius, r[1][1]),
  );
  const left = lineSegment<GlobalPoint>(
    pointFrom<GlobalPoint>(r[0][0], r[1][1] - radius),
    pointFrom<GlobalPoint>(r[0][0], r[0][1] + radius),
  );

  const baseCorners = [
    curve(
      left[1],
      pointFrom<GlobalPoint>(
        left[1][0] + (2 / 3) * (r[0][0] - left[1][0]),
        left[1][1] + (2 / 3) * (r[0][1] - left[1][1]),
      ),
      pointFrom<GlobalPoint>(
        top[0][0] + (2 / 3) * (r[0][0] - top[0][0]),
        top[0][1] + (2 / 3) * (r[0][1] - top[0][1]),
      ),
      top[0],
    ), // TOP LEFT
    curve(
      top[1],
      pointFrom<GlobalPoint>(
        top[1][0] + (2 / 3) * (r[1][0] - top[1][0]),
        top[1][1] + (2 / 3) * (r[0][1] - top[1][1]),
      ),
      pointFrom<GlobalPoint>(
        right[0][0] + (2 / 3) * (r[1][0] - right[0][0]),
        right[0][1] + (2 / 3) * (r[0][1] - right[0][1]),
      ),
      right[0],
    ), // TOP RIGHT
    curve(
      right[1],
      pointFrom<GlobalPoint>(
        right[1][0] + (2 / 3) * (r[1][0] - right[1][0]),
        right[1][1] + (2 / 3) * (r[1][1] - right[1][1]),
      ),
      pointFrom<GlobalPoint>(
        bottom[1][0] + (2 / 3) * (r[1][0] - bottom[1][0]),
        bottom[1][1] + (2 / 3) * (r[1][1] - bottom[1][1]),
      ),
      bottom[1],
    ), // BOTTOM RIGHT
    curve(
      bottom[0],
      pointFrom<GlobalPoint>(
        bottom[0][0] + (2 / 3) * (r[0][0] - bottom[0][0]),
        bottom[0][1] + (2 / 3) * (r[1][1] - bottom[0][1]),
      ),
      pointFrom<GlobalPoint>(
        left[0][0] + (2 / 3) * (r[0][0] - left[0][0]),
        left[0][1] + (2 / 3) * (r[1][1] - left[0][1]),
      ),
      left[0],
    ), // BOTTOM LEFT
  ];

  const corners =
    offset > 0
      ? baseCorners.map(
          (corner) =>
            curveCatmullRomCubicApproxPoints(
              curveOffsetPoints(corner, offset),
            )!,
        )
      : [
          [baseCorners[0]],
          [baseCorners[1]],
          [baseCorners[2]],
          [baseCorners[3]],
        ];

  const sides = [
    lineSegment<GlobalPoint>(
      corners[0][corners[0].length - 1][3],
      corners[1][0][0],
    ),
    lineSegment<GlobalPoint>(
      corners[1][corners[1].length - 1][3],
      corners[2][0][0],
    ),
    lineSegment<GlobalPoint>(
      corners[2][corners[2].length - 1][3],
      corners[3][0][0],
    ),
    lineSegment<GlobalPoint>(
      corners[3][corners[3].length - 1][3],
      corners[0][0][0],
    ),
  ];

  return [sides, corners.flat()];
}

/**
 * Get the building components of a diamond element in the form of
 * line segments and curves as a tuple, in this order.
 *
 * @param element The element to deconstruct
 * @param offset An optional offset
 * @returns Tuple of line segments (0) and curves (1)
 */
export function deconstructDiamondElementForCollision(
  element: ExcalidrawDiamondElement,
  offset: number = 0,
): [LineSegment<GlobalPoint>[], Curve<GlobalPoint>[]] {
  const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
    getDiamondPoints(element);
  const verticalRadius = element.roundness
    ? getCornerRadius(Math.abs(topX - leftX), element)
    : (topX - leftX) * 0.01;
  const horizontalRadius = element.roundness
    ? getCornerRadius(Math.abs(rightY - topY), element)
    : (rightY - topY) * 0.01;

  const [top, right, bottom, left]: GlobalPoint[] = [
    pointFrom(element.x + topX, element.y + topY),
    pointFrom(element.x + rightX, element.y + rightY),
    pointFrom(element.x + bottomX, element.y + bottomY),
    pointFrom(element.x + leftX, element.y + leftY),
  ];

  const baseCorners = [
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
  ];

  const corners =
    offset > 0
      ? baseCorners.map(
          (corner) =>
            curveCatmullRomCubicApproxPoints(
              curveOffsetPoints(corner, offset),
            )!,
        )
      : [
          [baseCorners[0]],
          [baseCorners[1]],
          [baseCorners[2]],
          [baseCorners[3]],
        ];

  const sides = [
    lineSegment<GlobalPoint>(
      corners[0][corners[0].length - 1][3],
      corners[1][0][0],
    ),
    lineSegment<GlobalPoint>(
      corners[1][corners[1].length - 1][3],
      corners[2][0][0],
    ),
    lineSegment<GlobalPoint>(
      corners[2][corners[2].length - 1][3],
      corners[3][0][0],
    ),
    lineSegment<GlobalPoint>(
      corners[3][corners[3].length - 1][3],
      corners[0][0][0],
    ),
  ];

  return [sides, corners.flat()];
}

const generateLinearShapesForCollision = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
) => {
  const generator = new RoughGenerator();
  const options: Options = {
    seed: element.seed,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    roughness: 0,
    preserveVertices: true,
  };

  switch (element.type) {
    case "line":
    case "arrow": {
      // points array can be empty in the beginning, so it is important to add
      // initial position to it
      const points = element.points.length
        ? element.points
        : [pointFrom<LocalPoint>(0, 0)];
      const [x1, y1, x2, y2] = getElementBounds(
        {
          ...element,
          angle: 0 as Radians,
        },
        new Map(),
      );
      const center = pointFrom<GlobalPoint>((x1 + x2) / 2, (y1 + y2) / 2);

      if (isElbowArrow(element)) {
        return generator.path(
          generateElbowArrowRougJshPathCommands(points, 16),
          options,
        ).sets[0].ops;
      } else if (!element.roundness) {
        return points.map((point, idx) => {
          const p = pointRotateRads(
            pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
            center,
            element.angle,
          );

          return {
            op: idx === 0 ? "move" : "lineTo",
            data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
          };
        });
      }

      return generator
        .curve(points as unknown as RoughPoint[], options)
        .sets[0].ops.slice(0, element.points.length)
        .map((op, i, arr) => {
          if (i === 0) {
            const p = pointRotateRads<GlobalPoint>(
              pointFrom<GlobalPoint>(
                element.x + op.data[0],
                element.y + op.data[1],
              ),
              center,
              element.angle,
            );

            return {
              op: "move",
              data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
            };
          }

          return {
            op: "bcurveTo",
            data: [
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[0],
                  element.y + op.data[1],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[2],
                  element.y + op.data[3],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[4],
                  element.y + op.data[5],
                ),
                center,
                element.angle,
              ),
            ]
              .map((p) =>
                pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
              )
              .flat(),
          };
        });
    }
    case "freedraw": {
      if (element.points.length < 2) {
        return [];
      }

      const simplifiedPoints = simplify(element.points as LocalPoint[], 0.75);

      return generator
        .curve(simplifiedPoints as [number, number][], options)
        .sets[0].ops.slice(0, element.points.length);
    }
  }
};
