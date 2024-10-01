import {
  isPoint,
  pointFrom,
  pointDistance,
  pointFromPair,
  pointRotateRads,
  pointsEqual,
  type GlobalPoint,
  type LocalPoint,
} from "../math";
import {
  getClosedCurveShape,
  getCurvePathOps,
  getCurveShape,
  getEllipseShape,
  getFreedrawShape,
  getPolygonShape,
  type GeometricShape,
} from "../utils/geometry/shape";
import {
  ArrowIcon,
  DiamondIcon,
  EllipseIcon,
  EraserIcon,
  FreedrawIcon,
  ImageIcon,
  LineIcon,
  RectangleIcon,
  SelectionIcon,
  TextIcon,
} from "./components/icons";
import {
  DEFAULT_ADAPTIVE_RADIUS,
  DEFAULT_PROPORTIONAL_RADIUS,
  LINE_CONFIRM_THRESHOLD,
  ROUNDNESS,
} from "./constants";
import { getElementAbsoluteCoords } from "./element";
import type { Bounds } from "./element/bounds";
import { shouldTestInside } from "./element/collision";
import { LinearElementEditor } from "./element/linearElementEditor";
import { getBoundTextElement } from "./element/textElement";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "./element/types";
import { KEYS } from "./keys";
import { ShapeCache } from "./scene/ShapeCache";
import type { NormalizedZoomValue, Zoom } from "./types";
import { invariant } from "./utils";

export const SHAPES = [
  {
    icon: SelectionIcon,
    value: "selection",
    key: KEYS.V,
    numericKey: KEYS["1"],
    fillable: true,
  },
  {
    icon: RectangleIcon,
    value: "rectangle",
    key: KEYS.R,
    numericKey: KEYS["2"],
    fillable: true,
  },
  {
    icon: DiamondIcon,
    value: "diamond",
    key: KEYS.D,
    numericKey: KEYS["3"],
    fillable: true,
  },
  {
    icon: EllipseIcon,
    value: "ellipse",
    key: KEYS.O,
    numericKey: KEYS["4"],
    fillable: true,
  },
  {
    icon: ArrowIcon,
    value: "arrow",
    key: KEYS.A,
    numericKey: KEYS["5"],
    fillable: true,
  },
  {
    icon: LineIcon,
    value: "line",
    key: KEYS.L,
    numericKey: KEYS["6"],
    fillable: true,
  },
  {
    icon: FreedrawIcon,
    value: "freedraw",
    key: [KEYS.P, KEYS.X],
    numericKey: KEYS["7"],
    fillable: false,
  },
  {
    icon: TextIcon,
    value: "text",
    key: KEYS.T,
    numericKey: KEYS["8"],
    fillable: false,
  },
  {
    icon: ImageIcon,
    value: "image",
    key: null,
    numericKey: KEYS["9"],
    fillable: false,
  },
  {
    icon: EraserIcon,
    value: "eraser",
    key: KEYS.E,
    numericKey: KEYS["0"],
    fillable: false,
  },
] as const;

export const findShapeByKey = (key: string) => {
  const shape = SHAPES.find((shape, index) => {
    return (
      (shape.numericKey != null && key === shape.numericKey.toString()) ||
      (shape.key &&
        (typeof shape.key === "string"
          ? shape.key === key
          : (shape.key as readonly string[]).includes(key)))
    );
  });
  return shape?.value || null;
};

/**
 * get the pure geometric shape of an excalidraw element
 * which is then used for hit detection
 */
export const getElementShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GeometricShape<Point> => {
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "frame":
    case "magicframe":
    case "embeddable":
    case "image":
    case "iframe":
    case "text":
    case "selection":
      return getPolygonShape(element);
    case "arrow":
    case "line": {
      const roughShape =
        ShapeCache.get(element)?.[0] ??
        ShapeCache.generateElementShape(element, null)[0];
      const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);

      return shouldTestInside(element)
        ? getClosedCurveShape<Point>(
            element,
            roughShape,
            pointFrom<Point>(element.x, element.y),
            element.angle,
            pointFrom(cx, cy),
          )
        : getCurveShape<Point>(
            roughShape,
            pointFrom<Point>(element.x, element.y),
            element.angle,
            pointFrom(cx, cy),
          );
    }

    case "ellipse":
      return getEllipseShape(element);

    case "freedraw": {
      const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);
      return getFreedrawShape(
        element,
        pointFrom(cx, cy),
        shouldTestInside(element),
      );
    }
  }
};

export const getBoundTextShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GeometricShape<Point> | null => {
  const boundTextElement = getBoundTextElement(element, elementsMap);

  if (boundTextElement) {
    if (element.type === "arrow") {
      return getElementShape(
        {
          ...boundTextElement,
          // arrow's bound text accurate position is not stored in the element's property
          // but rather calculated and returned from the following static method
          ...LinearElementEditor.getBoundTextElementPosition(
            element,
            boundTextElement,
            elementsMap,
          ),
        },
        elementsMap,
      );
    }
    return getElementShape(boundTextElement, elementsMap);
  }

  return null;
};

export const getControlPointsForBezierCurve = <
  P extends GlobalPoint | LocalPoint,
>(
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: P,
) => {
  const shape = ShapeCache.generateElementShape(element, null);
  if (!shape) {
    return null;
  }

  const ops = getCurvePathOps(shape[0]);
  let currentP = pointFrom<P>(0, 0);
  let index = 0;
  let minDistance = Infinity;
  let controlPoints: P[] | null = null;

  while (index < ops.length) {
    const { op, data } = ops[index];
    if (op === "move") {
      invariant(
        isPoint(data),
        "The returned ops is not compatible with a point",
      );
      currentP = pointFromPair(data);
    }
    if (op === "bcurveTo") {
      const p0 = currentP;
      const p1 = pointFrom<P>(data[0], data[1]);
      const p2 = pointFrom<P>(data[2], data[3]);
      const p3 = pointFrom<P>(data[4], data[5]);
      const distance = pointDistance(p3, endPoint);
      if (distance < minDistance) {
        minDistance = distance;
        controlPoints = [p0, p1, p2, p3];
      }
      currentP = p3;
    }
    index++;
  }

  return controlPoints;
};

export const getBezierXY = <P extends GlobalPoint | LocalPoint>(
  p0: P,
  p1: P,
  p2: P,
  p3: P,
  t: number,
): P => {
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);
  const tx = equation(t, 0);
  const ty = equation(t, 1);
  return pointFrom(tx, ty);
};

const getPointsInBezierCurve = <P extends GlobalPoint | LocalPoint>(
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: P,
) => {
  const controlPoints: P[] = getControlPointsForBezierCurve(element, endPoint)!;
  if (!controlPoints) {
    return [];
  }
  const pointsOnCurve: P[] = [];
  let t = 1;
  // Take 20 points on curve for better accuracy
  while (t > 0) {
    const p = getBezierXY(
      controlPoints[0],
      controlPoints[1],
      controlPoints[2],
      controlPoints[3],
      t,
    );
    pointsOnCurve.push(pointFrom(p[0], p[1]));
    t -= 0.05;
  }
  if (pointsOnCurve.length) {
    if (pointsEqual(pointsOnCurve.at(-1)!, endPoint)) {
      pointsOnCurve.push(pointFrom(endPoint[0], endPoint[1]));
    }
  }
  return pointsOnCurve;
};

const getBezierCurveArcLengths = <P extends GlobalPoint | LocalPoint>(
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: P,
) => {
  const arcLengths: number[] = [];
  arcLengths[0] = 0;
  const points = getPointsInBezierCurve(element, endPoint);
  let index = 0;
  let distance = 0;
  while (index < points.length - 1) {
    const segmentDistance = pointDistance(points[index], points[index + 1]);
    distance += segmentDistance;
    arcLengths.push(distance);
    index++;
  }

  return arcLengths;
};

export const getBezierCurveLength = <P extends GlobalPoint | LocalPoint>(
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: P,
) => {
  const arcLengths = getBezierCurveArcLengths(element, endPoint);
  return arcLengths.at(-1) as number;
};

// This maps interval to actual interval t on the curve so that when t = 0.5, its actually the point at 50% of the length
export const mapIntervalToBezierT = <P extends GlobalPoint | LocalPoint>(
  element: NonDeleted<ExcalidrawLinearElement>,
  endPoint: P,
  interval: number, // The interval between 0 to 1 for which you want to find the point on the curve,
) => {
  const arcLengths = getBezierCurveArcLengths(element, endPoint);
  const pointsCount = arcLengths.length - 1;
  const curveLength = arcLengths.at(-1) as number;
  const targetLength = interval * curveLength;
  let low = 0;
  let high = pointsCount;
  let index = 0;
  // Doing a binary search to find the largest length that is less than the target length
  while (low < high) {
    index = Math.floor(low + (high - low) / 2);
    if (arcLengths[index] < targetLength) {
      low = index + 1;
    } else {
      high = index;
    }
  }
  if (arcLengths[index] > targetLength) {
    index--;
  }
  if (arcLengths[index] === targetLength) {
    return index / pointsCount;
  }

  return (
    1 -
    (index +
      (targetLength - arcLengths[index]) /
        (arcLengths[index + 1] - arcLengths[index])) /
      pointsCount
  );
};

/**
 * Get the axis-aligned bounding box for a given element
 */
export const aabbForElement = (
  element: Readonly<ExcalidrawElement>,
  offset?: [number, number, number, number],
) => {
  const bbox = {
    minX: element.x,
    minY: element.y,
    maxX: element.x + element.width,
    maxY: element.y + element.height,
    midX: element.x + element.width / 2,
    midY: element.y + element.height / 2,
  };

  const center = pointFrom(bbox.midX, bbox.midY);
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

export const pointInsideBounds = <P extends GlobalPoint | LocalPoint>(
  p: P,
  bounds: Bounds,
): boolean =>
  p[0] > bounds[0] && p[0] < bounds[2] && p[1] > bounds[1] && p[1] < bounds[3];

export const aabbsOverlapping = (a: Bounds, b: Bounds) =>
  pointInsideBounds(pointFrom(a[0], a[1]), b) ||
  pointInsideBounds(pointFrom(a[2], a[1]), b) ||
  pointInsideBounds(pointFrom(a[2], a[3]), b) ||
  pointInsideBounds(pointFrom(a[0], a[3]), b) ||
  pointInsideBounds(pointFrom(b[0], b[1]), a) ||
  pointInsideBounds(pointFrom(b[2], b[1]), a) ||
  pointInsideBounds(pointFrom(b[2], b[3]), a) ||
  pointInsideBounds(pointFrom(b[0], b[3]), a);

export const getCornerRadius = (x: number, element: ExcalidrawElement) => {
  if (
    element.roundness?.type === ROUNDNESS.PROPORTIONAL_RADIUS ||
    element.roundness?.type === ROUNDNESS.LEGACY
  ) {
    return x * DEFAULT_PROPORTIONAL_RADIUS;
  }

  if (element.roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS) {
    const fixedRadiusSize = element.roundness?.value ?? DEFAULT_ADAPTIVE_RADIUS;

    const CUTOFF_SIZE = fixedRadiusSize / DEFAULT_PROPORTIONAL_RADIUS;

    if (x <= CUTOFF_SIZE) {
      return x * DEFAULT_PROPORTIONAL_RADIUS;
    }

    return fixedRadiusSize;
  }

  return 0;
};

// Checks if the first and last point are close enough
// to be considered a loop
export const isPathALoop = (
  points: ExcalidrawLinearElement["points"],
  /** supply if you want the loop detection to account for current zoom */
  zoomValue: Zoom["value"] = 1 as NormalizedZoomValue,
): boolean => {
  if (points.length >= 3) {
    const [first, last] = [points[0], points[points.length - 1]];
    const distance = pointDistance(first, last);

    // Adjusting LINE_CONFIRM_THRESHOLD to current zoom so that when zoomed in
    // really close we make the threshold smaller, and vice versa.
    return distance <= LINE_CONFIRM_THRESHOLD / zoomValue;
  }
  return false;
};
