import rough from "roughjs/bin/rough";

import { rescalePoints, arrayToMap, invariant } from "@excalidraw/common";

import {
  degreesToRadians,
  lineSegment,
  pointFrom,
  pointDistance,
  pointFromArray,
  pointRotateRads,
} from "@excalidraw/math";

import { getCurvePathOps } from "@excalidraw/utils/shape";

import { pointsOnBezierCurves } from "points-on-curve";

import type {
  Curve,
  Degrees,
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Radians,
} from "@excalidraw/math";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import { ShapeCache } from "./ShapeCache";
import { generateRoughOptions } from "./Shape";
import { LinearElementEditor } from "./linearElementEditor";
import { getBoundTextElement, getContainerElement } from "./textElement";
import {
  isArrowElement,
  isBoundToContainer,
  isFreeDrawElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";

import { getElementShape } from "./shapes";

import {
  deconstructDiamondElement,
  deconstructRectanguloidElement,
} from "./utils";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  Arrowhead,
  ExcalidrawFreeDrawElement,
  NonDeleted,
  ExcalidrawTextElementWithContainer,
  ElementsMap,
  ExcalidrawRectanguloidElement,
  ExcalidrawEllipseElement,
} from "./types";
import type { Drawable, Op } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";

export type RectangleBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
};

type MaybeQuadraticSolution = [number | null, number | null] | false;

/**
 * x and y position of top left corner, x and y position of bottom right corner
 */
export type Bounds = readonly [
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
];

export type SceneBounds = readonly [
  sceneX: number,
  sceneY: number,
  sceneX2: number,
  sceneY2: number,
];

export class ElementBounds {
  private static boundsCache = new WeakMap<
    ExcalidrawElement,
    {
      bounds: Bounds;
      version: ExcalidrawElement["version"];
    }
  >();

  static getBounds(element: ExcalidrawElement, elementsMap: ElementsMap) {
    const cachedBounds = ElementBounds.boundsCache.get(element);

    if (
      cachedBounds?.version &&
      cachedBounds.version === element.version &&
      // we don't invalidate cache when we update containers and not labels,
      // which is causing problems down the line. Fix TBA.
      !isBoundToContainer(element)
    ) {
      return cachedBounds.bounds;
    }
    const bounds = ElementBounds.calculateBounds(element, elementsMap);

    ElementBounds.boundsCache.set(element, {
      version: element.version,
      bounds,
    });

    return bounds;
  }

  private static calculateBounds(
    element: ExcalidrawElement,
    elementsMap: ElementsMap,
  ): Bounds {
    let bounds: Bounds;

    const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
      element,
      elementsMap,
    );
    if (isFreeDrawElement(element)) {
      const [minX, minY, maxX, maxY] = getBoundsFromPoints(
        element.points.map(([x, y]) =>
          pointRotateRads(
            pointFrom(x, y),
            pointFrom(cx - element.x, cy - element.y),
            element.angle,
          ),
        ),
      );

      return [
        minX + element.x,
        minY + element.y,
        maxX + element.x,
        maxY + element.y,
      ];
    } else if (isLinearElement(element)) {
      bounds = getLinearElementRotatedBounds(element, cx, cy, elementsMap);
    } else if (element.type === "diamond") {
      const [x11, y11] = pointRotateRads(
        pointFrom(cx, y1),
        pointFrom(cx, cy),
        element.angle,
      );
      const [x12, y12] = pointRotateRads(
        pointFrom(cx, y2),
        pointFrom(cx, cy),
        element.angle,
      );
      const [x22, y22] = pointRotateRads(
        pointFrom(x1, cy),
        pointFrom(cx, cy),
        element.angle,
      );
      const [x21, y21] = pointRotateRads(
        pointFrom(x2, cy),
        pointFrom(cx, cy),
        element.angle,
      );
      const minX = Math.min(x11, x12, x22, x21);
      const minY = Math.min(y11, y12, y22, y21);
      const maxX = Math.max(x11, x12, x22, x21);
      const maxY = Math.max(y11, y12, y22, y21);
      bounds = [minX, minY, maxX, maxY];
    } else if (element.type === "ellipse") {
      const w = (x2 - x1) / 2;
      const h = (y2 - y1) / 2;
      const cos = Math.cos(element.angle);
      const sin = Math.sin(element.angle);
      const ww = Math.hypot(w * cos, h * sin);
      const hh = Math.hypot(h * cos, w * sin);
      bounds = [cx - ww, cy - hh, cx + ww, cy + hh];
    } else {
      const [x11, y11] = pointRotateRads(
        pointFrom(x1, y1),
        pointFrom(cx, cy),
        element.angle,
      );
      const [x12, y12] = pointRotateRads(
        pointFrom(x1, y2),
        pointFrom(cx, cy),
        element.angle,
      );
      const [x22, y22] = pointRotateRads(
        pointFrom(x2, y2),
        pointFrom(cx, cy),
        element.angle,
      );
      const [x21, y21] = pointRotateRads(
        pointFrom(x2, y1),
        pointFrom(cx, cy),
        element.angle,
      );
      const minX = Math.min(x11, x12, x22, x21);
      const minY = Math.min(y11, y12, y22, y21);
      const maxX = Math.max(x11, x12, x22, x21);
      const maxY = Math.max(y11, y12, y22, y21);
      bounds = [minX, minY, maxX, maxY];
    }

    return bounds;
  }
}

// Scene -> Scene coords, but in x1,x2,y1,y2 format.
//
// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
export const getElementAbsoluteCoords = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  includeBoundText: boolean = false,
): [number, number, number, number, number, number] => {
  if (isFreeDrawElement(element)) {
    return getFreeDrawElementAbsoluteCoords(element);
  } else if (isLinearElement(element)) {
    return LinearElementEditor.getElementAbsoluteCoords(
      element,
      elementsMap,
      includeBoundText,
    );
  } else if (isTextElement(element)) {
    const container = elementsMap
      ? getContainerElement(element, elementsMap)
      : null;
    if (isArrowElement(container)) {
      const { x, y } = LinearElementEditor.getBoundTextElementPosition(
        container,
        element as ExcalidrawTextElementWithContainer,
        elementsMap,
      );
      return [
        x,
        y,
        x + element.width,
        y + element.height,
        x + element.width / 2,
        y + element.height / 2,
      ];
    }
  }
  return [
    element.x,
    element.y,
    element.x + element.width,
    element.y + element.height,
    element.x + element.width / 2,
    element.y + element.height / 2,
  ];
};

/*
 * for a given element, `getElementLineSegments` returns line segments
 * that can be used for visual collision detection (useful for frames)
 * as opposed to bounding box collision detection
 */
/**
 * Given an element, return the line segments that make up the element.
 *
 * Uses helpers from /math
 */
export const getElementLineSegments = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): LineSegment<GlobalPoint>[] => {
  const shape = getElementShape(element, elementsMap);
  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
  );
  const center = pointFrom<GlobalPoint>(cx, cy);

  if (shape.type === "polycurve") {
    const curves = shape.data;
    const points = curves
      .map((curve) => pointsOnBezierCurves(curve, 10))
      .flat();
    let i = 0;
    const segments: LineSegment<GlobalPoint>[] = [];
    while (i < points.length - 1) {
      segments.push(
        lineSegment(
          pointFrom(points[i][0], points[i][1]),
          pointFrom(points[i + 1][0], points[i + 1][1]),
        ),
      );
      i++;
    }

    return segments;
  } else if (shape.type === "polyline") {
    return shape.data as LineSegment<GlobalPoint>[];
  } else if (_isRectanguloidElement(element)) {
    const [sides, corners] = deconstructRectanguloidElement(element);
    const cornerSegments: LineSegment<GlobalPoint>[] = corners
      .map((corner) => getSegmentsOnCurve(corner, center, element.angle))
      .flat();
    const rotatedSides = getRotatedSides(sides, center, element.angle);
    return [...rotatedSides, ...cornerSegments];
  } else if (element.type === "diamond") {
    const [sides, corners] = deconstructDiamondElement(element);
    const cornerSegments = corners
      .map((corner) => getSegmentsOnCurve(corner, center, element.angle))
      .flat();
    const rotatedSides = getRotatedSides(sides, center, element.angle);

    return [...rotatedSides, ...cornerSegments];
  } else if (shape.type === "polygon") {
    if (isTextElement(element)) {
      const container = getContainerElement(element, elementsMap);
      if (container && isLinearElement(container)) {
        const segments: LineSegment<GlobalPoint>[] = [
          lineSegment(pointFrom(x1, y1), pointFrom(x2, y1)),
          lineSegment(pointFrom(x2, y1), pointFrom(x2, y2)),
          lineSegment(pointFrom(x2, y2), pointFrom(x1, y2)),
          lineSegment(pointFrom(x1, y2), pointFrom(x1, y1)),
        ];
        return segments;
      }
    }

    const points = shape.data as GlobalPoint[];
    const segments: LineSegment<GlobalPoint>[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      segments.push(lineSegment(points[i], points[i + 1]));
    }
    return segments;
  } else if (shape.type === "ellipse") {
    return getSegmentsOnEllipse(element as ExcalidrawEllipseElement);
  }

  const [nw, ne, sw, se, , , w, e] = (
    [
      [x1, y1],
      [x2, y1],
      [x1, y2],
      [x2, y2],
      [cx, y1],
      [cx, y2],
      [x1, cy],
      [x2, cy],
    ] as GlobalPoint[]
  ).map((point) => pointRotateRads(point, center, element.angle));

  return [
    lineSegment(nw, ne),
    lineSegment(sw, se),
    lineSegment(nw, sw),
    lineSegment(ne, se),
    lineSegment(nw, e),
    lineSegment(sw, e),
    lineSegment(ne, w),
    lineSegment(se, w),
  ];
};

const _isRectanguloidElement = (
  element: ExcalidrawElement,
): element is ExcalidrawRectanguloidElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

const getRotatedSides = (
  sides: LineSegment<GlobalPoint>[],
  center: GlobalPoint,
  angle: Radians,
) => {
  return sides.map((side) => {
    return lineSegment(
      pointRotateRads<GlobalPoint>(side[0], center, angle),
      pointRotateRads<GlobalPoint>(side[1], center, angle),
    );
  });
};

const getSegmentsOnCurve = (
  curve: Curve<GlobalPoint>,
  center: GlobalPoint,
  angle: Radians,
): LineSegment<GlobalPoint>[] => {
  const points = pointsOnBezierCurves(curve, 10);
  let i = 0;
  const segments: LineSegment<GlobalPoint>[] = [];
  while (i < points.length - 1) {
    segments.push(
      lineSegment(
        pointRotateRads<GlobalPoint>(
          pointFrom(points[i][0], points[i][1]),
          center,
          angle,
        ),
        pointRotateRads<GlobalPoint>(
          pointFrom(points[i + 1][0], points[i + 1][1]),
          center,
          angle,
        ),
      ),
    );
    i++;
  }

  return segments;
};

const getSegmentsOnEllipse = (
  ellipse: ExcalidrawEllipseElement,
): LineSegment<GlobalPoint>[] => {
  const center = pointFrom<GlobalPoint>(
    ellipse.x + ellipse.width / 2,
    ellipse.y + ellipse.height / 2,
  );

  const a = ellipse.width / 2;
  const b = ellipse.height / 2;

  const segments: LineSegment<GlobalPoint>[] = [];
  const points: GlobalPoint[] = [];
  const n = 90;
  const deltaT = (Math.PI * 2) / n;

  for (let i = 0; i < n; i++) {
    const t = i * deltaT;
    const x = center[0] + a * Math.cos(t);
    const y = center[1] + b * Math.sin(t);
    points.push(pointRotateRads(pointFrom(x, y), center, ellipse.angle));
  }

  for (let i = 0; i < points.length - 1; i++) {
    segments.push(lineSegment(points[i], points[i + 1]));
  }

  segments.push(lineSegment(points[points.length - 1], points[0]));
  return segments;
};

/**
 * Scene -> Scene coords, but in x1,x2,y1,y2 format.
 *
 * Rectangle here means any rectangular frame, not an excalidraw element.
 */
export const getRectangleBoxAbsoluteCoords = (boxSceneCoords: RectangleBox) => {
  return [
    boxSceneCoords.x,
    boxSceneCoords.y,
    boxSceneCoords.x + boxSceneCoords.width,
    boxSceneCoords.y + boxSceneCoords.height,
    boxSceneCoords.x + boxSceneCoords.width / 2,
    boxSceneCoords.y + boxSceneCoords.height / 2,
  ];
};

export const getDiamondPoints = (element: ExcalidrawElement) => {
  // Here we add +1 to avoid these numbers to be 0
  // otherwise rough.js will throw an error complaining about it
  const topX = Math.floor(element.width / 2) + 1;
  const topY = 0;
  const rightX = element.width;
  const rightY = Math.floor(element.height / 2) + 1;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = 0;
  const leftY = rightY;

  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
};

// reference: https://eliot-jones.com/2019/12/cubic-bezier-curve-bounding-boxes
const getBezierValueForT = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
) => {
  const oneMinusT = 1 - t;
  return (
    Math.pow(oneMinusT, 3) * p0 +
    3 * Math.pow(oneMinusT, 2) * t * p1 +
    3 * oneMinusT * Math.pow(t, 2) * p2 +
    Math.pow(t, 3) * p3
  );
};

const solveQuadratic = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): MaybeQuadraticSolution => {
  const i = p1 - p0;
  const j = p2 - p1;
  const k = p3 - p2;

  const a = 3 * i - 6 * j + 3 * k;
  const b = 6 * j - 6 * i;
  const c = 3 * i;

  const sqrtPart = b * b - 4 * a * c;
  const hasSolution = sqrtPart >= 0;

  if (!hasSolution) {
    return false;
  }

  let s1 = null;
  let s2 = null;

  let t1 = Infinity;
  let t2 = Infinity;

  if (a === 0) {
    t1 = t2 = -c / b;
  } else {
    t1 = (-b + Math.sqrt(sqrtPart)) / (2 * a);
    t2 = (-b - Math.sqrt(sqrtPart)) / (2 * a);
  }

  if (t1 >= 0 && t1 <= 1) {
    s1 = getBezierValueForT(t1, p0, p1, p2, p3);
  }

  if (t2 >= 0 && t2 <= 1) {
    s2 = getBezierValueForT(t2, p0, p1, p2, p3);
  }

  return [s1, s2];
};

const getCubicBezierCurveBound = (
  p0: GlobalPoint,
  p1: GlobalPoint,
  p2: GlobalPoint,
  p3: GlobalPoint,
): Bounds => {
  const solX = solveQuadratic(p0[0], p1[0], p2[0], p3[0]);
  const solY = solveQuadratic(p0[1], p1[1], p2[1], p3[1]);

  let minX = Math.min(p0[0], p3[0]);
  let maxX = Math.max(p0[0], p3[0]);

  if (solX) {
    const xs = solX.filter((x) => x !== null) as number[];
    minX = Math.min(minX, ...xs);
    maxX = Math.max(maxX, ...xs);
  }

  let minY = Math.min(p0[1], p3[1]);
  let maxY = Math.max(p0[1], p3[1]);
  if (solY) {
    const ys = solY.filter((y) => y !== null) as number[];
    minY = Math.min(minY, ...ys);
    maxY = Math.max(maxY, ...ys);
  }
  return [minX, minY, maxX, maxY];
};

export const getMinMaxXYFromCurvePathOps = (
  ops: Op[],
  transformXY?: (p: GlobalPoint) => GlobalPoint,
): Bounds => {
  let currentP: GlobalPoint = pointFrom(0, 0);

  const { minX, minY, maxX, maxY } = ops.reduce(
    (limits, { op, data }) => {
      // There are only four operation types:
      // move, bcurveTo, lineTo, and curveTo
      if (op === "move") {
        // change starting point
        const p: GlobalPoint | undefined = pointFromArray(data);
        invariant(p != null, "Op data is not a point");
        currentP = p;
        // move operation does not draw anything; so, it always
        // returns false
      } else if (op === "bcurveTo") {
        const _p1 = pointFrom<GlobalPoint>(data[0], data[1]);
        const _p2 = pointFrom<GlobalPoint>(data[2], data[3]);
        const _p3 = pointFrom<GlobalPoint>(data[4], data[5]);

        const p1 = transformXY ? transformXY(_p1) : _p1;
        const p2 = transformXY ? transformXY(_p2) : _p2;
        const p3 = transformXY ? transformXY(_p3) : _p3;

        const p0 = transformXY ? transformXY(currentP) : currentP;
        currentP = _p3;

        const [minX, minY, maxX, maxY] = getCubicBezierCurveBound(
          p0,
          p1,
          p2,
          p3,
        );

        limits.minX = Math.min(limits.minX, minX);
        limits.minY = Math.min(limits.minY, minY);

        limits.maxX = Math.max(limits.maxX, maxX);
        limits.maxY = Math.max(limits.maxY, maxY);
      } else if (op === "lineTo") {
        // TODO: Implement this
      } else if (op === "qcurveTo") {
        // TODO: Implement this
      }
      return limits;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  return [minX, minY, maxX, maxY];
};

export const getBoundsFromPoints = (
  points: ExcalidrawFreeDrawElement["points"],
): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
};

const getFreeDrawElementAbsoluteCoords = (
  element: ExcalidrawFreeDrawElement,
): [number, number, number, number, number, number] => {
  const [minX, minY, maxX, maxY] = getBoundsFromPoints(element.points);
  const x1 = minX + element.x;
  const y1 = minY + element.y;
  const x2 = maxX + element.x;
  const y2 = maxY + element.y;
  return [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2];
};

/** @returns number in pixels */
export const getArrowheadSize = (arrowhead: Arrowhead): number => {
  switch (arrowhead) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    case "crowfoot_many":
    case "crowfoot_one":
    case "crowfoot_one_or_many":
      return 20;
    default:
      return 15;
  }
};

/** @returns number in degrees */
export const getArrowheadAngle = (arrowhead: Arrowhead): Degrees => {
  switch (arrowhead) {
    case "bar":
      return 90 as Degrees;
    case "arrow":
      return 20 as Degrees;
    default:
      return 25 as Degrees;
  }
};

export const getArrowheadPoints = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
) => {
  if (shape.length < 1) {
    return null;
  }

  const ops = getCurvePathOps(shape[0]);
  if (ops.length < 1) {
    return null;
  }

  // The index of the bCurve operation to examine.
  const index = position === "start" ? 1 : ops.length - 1;

  const data = ops[index].data;

  invariant(data.length === 6, "Op data length is not 6");

  const p3 = pointFrom(data[4], data[5]);
  const p2 = pointFrom(data[2], data[3]);
  const p1 = pointFrom(data[0], data[1]);

  // We need to find p0 of the bezier curve.
  // It is typically the last point of the previous
  // curve; it can also be the position of moveTo operation.
  const prevOp = ops[index - 1];
  let p0 = pointFrom(0, 0);
  if (prevOp.op === "move") {
    const p = pointFromArray(prevOp.data);
    invariant(p != null, "Op data is not a point");
    p0 = p;
  } else if (prevOp.op === "bcurveTo") {
    p0 = pointFrom(prevOp.data[4], prevOp.data[5]);
  }

  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // Ee know the last point of the arrow (or the first, if start arrowhead).
  const [x2, y2] = position === "start" ? p0 : p3;

  // By using cubic bezier equation (B(t)) and the given parameters,
  // we calculate a point that is closer to the last point.
  // The value 0.3 is chosen arbitrarily and it works best for all
  // the tested cases.
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];

  // Find the normalized direction vector based on the
  // previously calculated points.
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance;
  const ny = (y2 - y1) / distance;

  const size = getArrowheadSize(arrowhead);

  let length = 0;

  {
    // Length for -> arrows is based on the length of the last section
    const [cx, cy] =
      position === "end"
        ? element.points[element.points.length - 1]
        : element.points[0];
    const [px, py] =
      element.points.length > 1
        ? position === "end"
          ? element.points[element.points.length - 2]
          : element.points[1]
        : [0, 0];

    length = Math.hypot(cx - px, cy - py);
  }

  // Scale down the arrowhead until we hit a certain size so that it doesn't look weird.
  // This value is selected by minimizing a minimum size with the last segment of the arrowhead
  const lengthMultiplier =
    arrowhead === "diamond" || arrowhead === "diamond_outline" ? 0.25 : 0.5;
  const minSize = Math.min(size, length * lengthMultiplier);
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  if (
    arrowhead === "dot" ||
    arrowhead === "circle" ||
    arrowhead === "circle_outline"
  ) {
    const diameter = Math.hypot(ys - y2, xs - x2) + element.strokeWidth - 2;
    return [x2, y2, diameter];
  }

  const angle = getArrowheadAngle(arrowhead);

  if (arrowhead === "crowfoot_many" || arrowhead === "crowfoot_one_or_many") {
    // swap (xs, ys) with (x2, y2)
    const [x3, y3] = pointRotateRads(
      pointFrom(x2, y2),
      pointFrom(xs, ys),
      degreesToRadians(-angle as Degrees),
    );
    const [x4, y4] = pointRotateRads(
      pointFrom(x2, y2),
      pointFrom(xs, ys),
      degreesToRadians(angle),
    );
    return [xs, ys, x3, y3, x4, y4];
  }

  // Return points
  const [x3, y3] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    ((-angle * Math.PI) / 180) as Radians,
  );
  const [x4, y4] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    degreesToRadians(angle),
  );

  if (arrowhead === "diamond" || arrowhead === "diamond_outline") {
    // point opposite to the arrowhead point
    let ox;
    let oy;

    if (position === "start") {
      const [px, py] = element.points.length > 1 ? element.points[1] : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(x2 + minSize * 2, y2),
        pointFrom(x2, y2),
        Math.atan2(py - y2, px - x2) as Radians,
      );
    } else {
      const [px, py] =
        element.points.length > 1
          ? element.points[element.points.length - 2]
          : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(x2 - minSize * 2, y2),
        pointFrom(x2, y2),
        Math.atan2(y2 - py, x2 - px) as Radians,
      );
    }

    return [x2, y2, x3, y3, ox, oy, x4, y4];
  }

  return [x2, y2, x3, y3, x4, y4];
};

const generateLinearElementShape = (
  element: ExcalidrawLinearElement,
): Drawable => {
  const generator = rough.generator();
  const options = generateRoughOptions(element);

  const method = (() => {
    if (element.roundness) {
      return "curve";
    }
    if (options.fill) {
      return "polygon";
    }
    return "linearPath";
  })();

  return generator[method](
    element.points as Mutable<LocalPoint>[] as RoughPoint[],
    options,
  );
};

const getLinearElementRotatedBounds = (
  element: ExcalidrawLinearElement,
  cx: number,
  cy: number,
  elementsMap: ElementsMap,
): Bounds => {
  const boundTextElement = getBoundTextElement(element, elementsMap);

  if (element.points.length < 2) {
    const [pointX, pointY] = element.points[0];
    const [x, y] = pointRotateRads(
      pointFrom(element.x + pointX, element.y + pointY),
      pointFrom(cx, cy),
      element.angle,
    );

    let coords: Bounds = [x, y, x, y];
    if (boundTextElement) {
      const coordsWithBoundText = LinearElementEditor.getMinMaxXYWithBoundText(
        element,
        elementsMap,
        [x, y, x, y],
        boundTextElement,
      );
      coords = [
        coordsWithBoundText[0],
        coordsWithBoundText[1],
        coordsWithBoundText[2],
        coordsWithBoundText[3],
      ];
    }
    return coords;
  }

  // first element is always the curve
  const cachedShape = ShapeCache.get(element)?.[0];
  const shape = cachedShape ?? generateLinearElementShape(element);
  const ops = getCurvePathOps(shape);
  const transformXY = ([x, y]: GlobalPoint) =>
    pointRotateRads<GlobalPoint>(
      pointFrom(element.x + x, element.y + y),
      pointFrom(cx, cy),
      element.angle,
    );
  const res = getMinMaxXYFromCurvePathOps(ops, transformXY);
  let coords: Bounds = [res[0], res[1], res[2], res[3]];
  if (boundTextElement) {
    const coordsWithBoundText = LinearElementEditor.getMinMaxXYWithBoundText(
      element,
      elementsMap,
      coords,
      boundTextElement,
    );
    coords = [
      coordsWithBoundText[0],
      coordsWithBoundText[1],
      coordsWithBoundText[2],
      coordsWithBoundText[3],
    ];
  }
  return coords;
};

export const getElementBounds = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): Bounds => {
  return ElementBounds.getBounds(element, elementsMap);
};

export const getCommonBounds = (
  elements: readonly ExcalidrawElement[],
  elementsMap?: ElementsMap,
): Bounds => {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const _elementsMap = elementsMap || arrayToMap(elements);

  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element, _elementsMap);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  });

  return [minX, minY, maxX, maxY];
};

export const getDraggedElementsBounds = (
  elements: ExcalidrawElement[],
  dragOffset: { x: number; y: number },
) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  return [
    minX + dragOffset.x,
    minY + dragOffset.y,
    maxX + dragOffset.x,
    maxY + dragOffset.y,
  ];
};

export const getResizedElementAbsoluteCoords = (
  element: ExcalidrawElement,
  nextWidth: number,
  nextHeight: number,
  normalizePoints: boolean,
): Bounds => {
  if (!(isLinearElement(element) || isFreeDrawElement(element))) {
    return [
      element.x,
      element.y,
      element.x + nextWidth,
      element.y + nextHeight,
    ];
  }

  const points = rescalePoints(
    0,
    nextWidth,
    rescalePoints(1, nextHeight, element.points, normalizePoints),
    normalizePoints,
  );

  let bounds: Bounds;

  if (isFreeDrawElement(element)) {
    // Free Draw
    bounds = getBoundsFromPoints(points);
  } else {
    // Line
    const gen = rough.generator();
    const curve = !element.roundness
      ? gen.linearPath(
          points as [number, number][],
          generateRoughOptions(element),
        )
      : gen.curve(points as [number, number][], generateRoughOptions(element));

    const ops = getCurvePathOps(curve);
    bounds = getMinMaxXYFromCurvePathOps(ops);
  }

  const [minX, minY, maxX, maxY] = bounds;
  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

export const getElementPointsCoords = (
  element: ExcalidrawLinearElement,
  points: readonly (readonly [number, number])[],
): Bounds => {
  // This might be computationally heavey
  const gen = rough.generator();
  const curve =
    element.roundness == null
      ? gen.linearPath(
          points as [number, number][],
          generateRoughOptions(element),
        )
      : gen.curve(points as [number, number][], generateRoughOptions(element));
  const ops = getCurvePathOps(curve);
  const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);
  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

export const getClosestElementBounds = (
  elements: readonly ExcalidrawElement[],
  from: { x: number; y: number },
): Bounds => {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minDistance = Infinity;
  let closestElement = elements[0];
  const elementsMap = arrayToMap(elements);
  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
    const distance = pointDistance(
      pointFrom((x1 + x2) / 2, (y1 + y2) / 2),
      pointFrom(from.x, from.y),
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestElement = element;
    }
  });

  return getElementBounds(closestElement, elementsMap);
};

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  midX: number;
  midY: number;
  width: number;
  height: number;
}

export const getCommonBoundingBox = (
  elements: ExcalidrawElement[] | readonly NonDeleted<ExcalidrawElement>[],
): BoundingBox => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
  };
};

/**
 * returns scene coords of user's editor viewport (visible canvas area) bounds
 */
export const getVisibleSceneBounds = ({
  scrollX,
  scrollY,
  width,
  height,
  zoom,
}: AppState): SceneBounds => {
  return [
    -scrollX,
    -scrollY,
    -scrollX + width / zoom.value,
    -scrollY + height / zoom.value,
  ];
};

export const getCenterForBounds = (bounds: Bounds): GlobalPoint =>
  pointFrom(
    bounds[0] + (bounds[2] - bounds[0]) / 2,
    bounds[1] + (bounds[3] - bounds[1]) / 2,
  );

export const doBoundsIntersect = (
  bounds1: Bounds | null,
  bounds2: Bounds | null,
): boolean => {
  if (bounds1 == null || bounds2 == null) {
    return false;
  }

  const [minX1, minY1, maxX1, maxY1] = bounds1;
  const [minX2, minY2, maxX2, maxY2] = bounds2;

  return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
};
