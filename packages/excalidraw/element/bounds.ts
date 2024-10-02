import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawTextElementWithContainer,
  ElementsMap,
  Bounds,
} from "./types";
import rough from "roughjs/bin/rough";
import type { Point as RoughPoint } from "roughjs/bin/geometry";
import type { Drawable, Op } from "roughjs/bin/core";
import type { AppState } from "../types";
import { generateRoughOptions } from "../scene/Shape";
import {
  isArrowElement,
  isBoundToContainer,
  isFreeDrawElement,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import { getBoundTextElement, getContainerElement } from "./textElement";
import { LinearElementEditor } from "./linearElementEditor";
import { ShapeCache } from "../scene/ShapeCache";
import { arrayToMap, invariant } from "../utils";
import type { GlobalPoint, LocalPoint, Segment } from "../../math";
import {
  pointFrom,
  pointDistance,
  pointFromArray,
  pointRotateRads,
  pointRescaleFromTopLeft,
  segment,
  ellipseSegmentInterceptPoints,
  ellipse,
  arc,
  radians,
  cartesian2Polar,
  normalizeRadians,
  radiansToDegrees,
} from "../../math";
import type { Mutable } from "../utility-types";
import { getCurvePathOps } from "../../utils/geometry/shape";

type MaybeQuadraticSolution = [number | null, number | null] | false;

export type ViewportBounds = readonly [
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
      versionNonce: ExcalidrawElement["versionNonce"];
    }
  >();

  static getBounds(element: ExcalidrawElement, elementsMap: ElementsMap) {
    const cachedBounds = ElementBounds.boundsCache.get(element);

    if (
      cachedBounds?.version &&
      cachedBounds.version === element.version &&
      cachedBounds?.versionNonce === element.versionNonce &&
      // we don't invalidate cache when we update containers and not labels,
      // which is causing problems down the line. Fix TBA.
      !isBoundToContainer(element)
    ) {
      return cachedBounds.bounds;
    }
    const bounds = ElementBounds.calculateBounds(element, elementsMap);

    ElementBounds.boundsCache.set(element, {
      version: element.version,
      versionNonce: element.versionNonce,
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
      const [minX, minY, maxX, maxY] = getBoundsFromFreeDrawPoints(
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

/**
 * Get the axis-aligned bounds of the given element in global / scene coordinates
 *
 * @param element The element to determine the bounding box for
 * @param elementsMap The elements map to retrieve attached elements (notably text label)
 * @returns The axis-aligned bounding box in scene (global coordinates)
 */
export const getElementBounds = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): Bounds => {
  return ElementBounds.getBounds(element, elementsMap);
};

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

const getBoundsFromFreeDrawPoints = (
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
  const [minX, minY, maxX, maxY] = getBoundsFromFreeDrawPoints(element.points);
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

  const points = pointRescaleFromTopLeft(
    0,
    nextWidth,
    pointRescaleFromTopLeft(1, nextHeight, element.points, normalizePoints),
    normalizePoints,
  );

  let bounds: Bounds;

  if (isFreeDrawElement(element)) {
    // Free Draw
    bounds = getBoundsFromFreeDrawPoints(points);
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
}: AppState): ViewportBounds => {
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

/**
 * Shortens a segment on both ends to accomodate the arc in the rounded
 * diamond shape
 *
 * @param s The segment to shorten
 * @param r The radius to shorten by
 * @returns The segment shortened on both ends by the same radius
 */
export const createDiamondSide = (
  s: Segment<GlobalPoint>,
  startRadius: number,
  endRadius: number,
): Segment<GlobalPoint> => {
  return segment(
    ellipseSegmentInterceptPoints(
      ellipse(s[0], startRadius, startRadius),
      s,
    )[0] ?? s[0],
    ellipseSegmentInterceptPoints(ellipse(s[1], endRadius, endRadius), s)[0] ??
      s[1],
  );
};

/**
 * Creates an arc for the given roundness and position by taking the start
 * and end positions and determining the angle points on the hypotethical
 * circle with center point between start and end and raidus equals provided
 * roundness. I.e. the created arc is gobal point-aware, or "rotated" in-place.
 *
 * @param start
 * @param end
 * @param r
 * @returns
 */
export const createDiamondArc = (
  start: GlobalPoint,
  end: GlobalPoint,
  c: GlobalPoint,
  r: number,
) => {
  const [, startAngle] = cartesian2Polar(
    pointFrom(start[0] - c[0], start[1] - c[1]),
  );
  const [, endAngle] = cartesian2Polar(pointFrom(end[0] - c[0], end[1] - c[1]));

  return arc(
    c,
    r,
    normalizeRadians(startAngle), // normalizeRadians(radians(startAngle - Math.PI / 2)),
    normalizeRadians(endAngle), // normalizeRadians(radians(endAngle - Math.PI / 2)),
  );
};
