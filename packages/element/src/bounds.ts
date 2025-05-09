import rough from "roughjs/bin/rough";

import {
  arrayToMap,
  elementCenterPoint,
  invariant,
  rescalePoints,
  sizeOf,
} from "@excalidraw/common";

import {
  lineSegment,
  pointDistance,
  pointFrom,
  pointFromArray,
  pointRotateRads,
} from "@excalidraw/math";

import { getCurvePathOps } from "@excalidraw/utils/shape";

import { pointsOnBezierCurves } from "points-on-curve";

import type {
  Curve,
  GlobalPoint,
  LineSegment,
  LocalPoint,
  Radians,
} from "@excalidraw/math";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import { generateRoughOptions } from "./Shape";
import { ShapeCache } from "./ShapeCache";
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

import type { Drawable, Op } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";
import type {
  ElementsMap,
  ElementsMapOrArray,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawRectanguloidElement,
  ExcalidrawTextElementWithContainer,
} from "./types";

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

class ElementBounds {
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
export const getRectangleBoxAbsoluteCoords = (boxSceneCoords: {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}) => {
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
): [number | null, number | null] | false => {
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

export const getCubicBezierCurveBound = (
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
  elements: ElementsMapOrArray,
  elementsMap?: ElementsMap,
): Bounds => {
  if (!sizeOf(elements)) {
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

export const aabbForCubicBezierCurve = ([
  [x0, y0],
  [x1, y1],
  [x2, y2],
  [x3, y3],
]: Curve<GlobalPoint>): Bounds => {
  // Solving for X dimension
  const solX = solveQuadratic(x0, x1, x2, x3);
  // Solving for Y dimension
  const solY = solveQuadratic(y0, y1, y2, y3);

  // Start with the bounds of the start and end points
  let minX = Math.min(x0, x3);
  let maxX = Math.max(x0, x3);

  // Add potential extrema points in X dimension
  if (solX) {
    const xs = solX.filter((x) => x !== null) as number[];
    minX = Math.min(minX, ...xs);
    maxX = Math.max(maxX, ...xs);
  }

  // Start with the bounds of the start and end points
  let minY = Math.min(y0, y3);
  let maxY = Math.max(y0, y3);

  // Add potential extrema points in Y dimension
  if (solY) {
    const ys = solY.filter((y) => y !== null) as number[];
    minY = Math.min(minY, ...ys);
    maxY = Math.max(maxY, ...ys);
  }

  return [minX, minY, maxX, maxY];
};

const aabbForLinearOrFreeDraw = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
): Bounds => {
  let [xs, ys] = element.points.reduce<[number[], number[]]>(
    (acc, point) => {
      acc[0].push(element.x + point[0]);
      acc[1].push(element.y + point[1]);
      return acc;
    },
    [[], []],
  );

  if (element.angle !== 0) {
    const cx = (Math.min(...xs, element.x) + Math.max(...xs, element.x)) / 2;
    const cy = (Math.min(...ys, element.y) + Math.max(...ys, element.y)) / 2;
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);

    [xs, ys] = [
      xs.map((x, i) => (x - cx) * cos - (ys[i] - cy) * sin + cx),
      ys.map((y, i) => (xs[i] - cx) * sin + (y - cy) * cos + cy),
    ];
  }

  return [
    Math.min(...xs, element.x),
    Math.min(...ys, element.y),
    Math.max(...xs, element.x),
    Math.max(...ys, element.y),
  ];
};

const aabbForNonLinearAndNonFreeDrawElement = <E>(
  element: E extends ExcalidrawLinearElement | ExcalidrawFreeDrawElement
    ? never
    : ExcalidrawElement,
): Bounds => {
  const bbox = {
    minX: element.x,
    minY: element.y,
    maxX: element.x + element.width,
    maxY: element.y + element.height,
  };

  const center = elementCenterPoint(element);
  const [topLeftX, topLeftY] = pointRotateRads(
    pointFrom(bbox.minX, bbox.minY),
    center,
    element.angle,
  );
  const [topRightX, topRightY] = pointRotateRads(
    pointFrom(bbox.maxX, bbox.minY),
    center,
    element.angle,
  );
  const [bottomRightX, bottomRightY] = pointRotateRads(
    pointFrom(bbox.maxX, bbox.maxY),
    center,
    element.angle,
  );
  const [bottomLeftX, bottomLeftY] = pointRotateRads(
    pointFrom(bbox.minX, bbox.maxY),
    center,
    element.angle,
  );

  const bounds = [
    Math.min(topLeftX, topRightX, bottomRightX, bottomLeftX),
    Math.min(topLeftY, topRightY, bottomRightY, bottomLeftY),
    Math.max(topLeftX, topRightX, bottomRightX, bottomLeftX),
    Math.max(topLeftY, topRightY, bottomRightY, bottomLeftY),
  ] as Bounds;

  return bounds;
};

/**
 * Get the axis-aligned bounding box for a given element
 */
export const aabbForElement = (
  element: Readonly<ExcalidrawElement>,
  offset?: [number, number, number, number],
) => {
  const bounds =
    isLinearElement(element) || isFreeDrawElement(element)
      ? aabbForLinearOrFreeDraw(element)
      : aabbForNonLinearAndNonFreeDrawElement(element);

  if (offset) {
    const [topOffset, rightOffset, downOffset, leftOffset] = offset;
    return [
      bounds[0] - leftOffset,
      bounds[1] - topOffset,
      bounds[2] + rightOffset,
      bounds[3] + downOffset,
    ] as Bounds;
  }

  return bounds;
};

/**
 * Determine if a point is inside a given axis-aligned bounding box
 *
 * @param p
 * @param bounds
 * @returns
 */
export const pointInsideBounds = <P extends GlobalPoint | LocalPoint>(
  p: P,
  bounds: Bounds,
): boolean =>
  p[0] > bounds[0] && p[0] < bounds[2] && p[1] > bounds[1] && p[1] < bounds[3];
