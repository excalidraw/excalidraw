/**
 * this file defines pure geometric shapes
 *
 * for instance, a cubic bezier curve is specified by its four control points and
 * an ellipse is defined by its center, angle, semi major axis and semi minor axis
 * (but in semi-width and semi-height so it's more relevant to Excalidraw)
 *
 * the idea with pure shapes is so that we can provide collision and other geoemtric methods not depending on
 * the specifics of roughjs or elements in Excalidraw; instead, we can focus on the pure shapes themselves
 *
 * also included in this file are methods for converting an Excalidraw element or a Drawable from roughjs
 * to pure shapes
 */

import type {
  Curve,
  Ellipse,
  GenericPoint,
  Segment,
  Polygon,
  Radians,
  ViewportPoint,
} from "../../math";
import {
  curve,
  ellipse,
  segment,
  point,
  pointFromArray,
  pointFromVector,
  pointRotateRads,
  polygon,
  polygonFromPoints,
  segmentsIntersectAt,
  vector,
  vectorAdd,
  vectorFromPoint,
  type GlobalPoint,
  type LocalPoint,
} from "../../math";
import { getElementAbsoluteCoords } from "../../excalidraw/element";
import type {
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawIframeElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
} from "../../excalidraw/element/types";
import { pointsOnBezierCurves } from "points-on-curve";
import type { Drawable, Op } from "roughjs/bin/core";
import { invariant } from "../../excalidraw/utils";

// a polyline (made up term here) is a line consisting of other line segments
// this corresponds to a straight line element in the editor but it could also
// be used to model other elements
export type Polyline<Point extends GlobalPoint | LocalPoint | ViewportPoint> =
  Segment<Point>[];

// a polycurve is a curve consisting of ther curves, this corresponds to a complex
// curve on the canvas
export type Polycurve<Point extends GlobalPoint | LocalPoint | ViewportPoint> =
  Curve<Point>[];

export type GeometricShape<Point extends GenericPoint> =
  | {
      type: "line";
      data: Segment<Point>;
    }
  | {
      type: "polygon";
      data: Polygon<Point>;
    }
  | {
      type: "curve";
      data: Curve<Point>;
    }
  | {
      type: "ellipse";
      data: Ellipse<Point>;
    }
  | {
      type: "polyline";
      data: Polyline<Point>;
    }
  | {
      type: "polycurve";
      data: Polycurve<Point>;
    };

type RectangularElement =
  | ExcalidrawRectangleElement
  | ExcalidrawDiamondElement
  | ExcalidrawFrameLikeElement
  | ExcalidrawEmbeddableElement
  | ExcalidrawImageElement
  | ExcalidrawIframeElement
  | ExcalidrawTextElement
  | ExcalidrawSelectionElement;

// polygon
export const getPolygonShape = <Point extends GlobalPoint | LocalPoint>(
  element: RectangularElement,
): GeometricShape<Point> => {
  const { angle, width, height, x, y } = element;

  const cx = x + width / 2;
  const cy = y + height / 2;

  const center: Point = point(cx, cy);

  let data: Polygon<Point>;

  if (element.type === "diamond") {
    data = polygon(
      pointRotateRads(point(cx, y), center, angle),
      pointRotateRads(point(x + width, cy), center, angle),
      pointRotateRads(point(cx, y + height), center, angle),
      pointRotateRads(point(x, cy), center, angle),
    );
  } else {
    data = polygon(
      pointRotateRads(point(x, y), center, angle),
      pointRotateRads(point(x + width, y), center, angle),
      pointRotateRads(point(x + width, y + height), center, angle),
      pointRotateRads(point(x, y + height), center, angle),
    );
  }

  return {
    type: "polygon",
    data,
  };
};

// return the selection box for an element, possibly rotated as well
export const getSelectionBoxShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  padding = 10,
) => {
  let [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
    true,
  );

  x1 -= padding;
  x2 += padding;
  y1 -= padding;
  y2 += padding;

  //const angleInDegrees = angleToDegrees(element.angle);
  const center = point(cx, cy);
  const topLeft = pointRotateRads(point(x1, y1), center, element.angle);
  const topRight = pointRotateRads(point(x2, y1), center, element.angle);
  const bottomLeft = pointRotateRads(point(x1, y2), center, element.angle);
  const bottomRight = pointRotateRads(point(x2, y2), center, element.angle);

  return {
    type: "polygon",
    data: [topLeft, topRight, bottomRight, bottomLeft],
  } as GeometricShape<Point>;
};

// ellipse
export const getEllipseShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawEllipseElement,
): GeometricShape<Point> => {
  const { width, height, angle, x, y } = element;

  return {
    type: "ellipse",
    data: ellipse(
      point(x + width / 2, y + height / 2),
      angle,
      width / 2,
      height / 2,
    ),
  };
};

export const getCurvePathOps = (shape: Drawable): Op[] => {
  for (const set of shape.sets) {
    if (set.type === "path") {
      return set.ops;
    }
  }
  return shape.sets[0].ops;
};

// linear
export const getCurveShape = <Point extends GlobalPoint | LocalPoint>(
  roughShape: Drawable,
  startingPoint: Point = point(0, 0),
  angleInRadian: Radians,
  center: Point,
): GeometricShape<Point> => {
  const transform = (p: Point): Point =>
    pointRotateRads(
      point(p[0] + startingPoint[0], p[1] + startingPoint[1]),
      center,
      angleInRadian,
    );

  const ops = getCurvePathOps(roughShape);
  const polycurve: Polycurve<Point> = [];
  let p0 = point<Point>(0, 0);

  for (const op of ops) {
    if (op.op === "move") {
      const p = pointFromArray<Point>(op.data);
      invariant(p != null, "Ops data is not a point");
      p0 = transform(p);
    }
    if (op.op === "bcurveTo") {
      const p1 = transform(point<Point>(op.data[0], op.data[1]));
      const p2 = transform(point<Point>(op.data[2], op.data[3]));
      const p3 = transform(point<Point>(op.data[4], op.data[5]));
      polycurve.push(curve<Point>(p0, p1, p2, p3));
      p0 = p3;
    }
  }

  return {
    type: "polycurve",
    data: polycurve,
  };
};

const polylineFromPoints = <
  Point extends GlobalPoint | LocalPoint | ViewportPoint,
>(
  points: Point[],
): Polyline<Point> => {
  let previousPoint: Point = points[0];
  const polyline: Segment<Point>[] = [];

  for (let i = 1; i < points.length; i++) {
    const nextPoint = points[i];
    polyline.push(segment<Point>(previousPoint, nextPoint));
    previousPoint = nextPoint;
  }

  return polyline;
};

export const getFreedrawShape = (
  element: ExcalidrawFreeDrawElement,
  center: GlobalPoint,
  isClosed: boolean = false,
): GeometricShape<GlobalPoint> => {
  const transform = (p: Readonly<LocalPoint>): GlobalPoint =>
    pointRotateRads(
      pointFromVector(
        vectorAdd(vectorFromPoint(p), vector(element.x, element.y)),
      ),
      center,
      element.angle,
    );

  const polyline = polylineFromPoints(element.points.map((p) => transform(p)));

  return (
    isClosed
      ? {
          type: "polygon",
          data: polygonFromPoints(polyline.flat()),
        }
      : {
          type: "polyline",
          data: polyline,
        }
  ) as GeometricShape<GlobalPoint>;
};

export const getClosedCurveShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawLinearElement,
  roughShape: Drawable,
  startingPoint: Point = point<Point>(0, 0),
  angleInRadian: Radians,
  center: Point,
): GeometricShape<Point> => {
  const transform = (p: Point) =>
    pointRotateRads(
      point(p[0] + startingPoint[0], p[1] + startingPoint[1]),
      center,
      angleInRadian,
    );

  if (element.roundness === null) {
    return {
      type: "polygon",
      data: polygonFromPoints(
        element.points.map((p) => transform(p as Point)) as Point[],
      ),
    };
  }

  const ops = getCurvePathOps(roughShape);

  const points: Point[] = [];
  let odd = false;
  for (const operation of ops) {
    if (operation.op === "move") {
      odd = !odd;
      if (odd) {
        points.push(point(operation.data[0], operation.data[1]));
      }
    } else if (operation.op === "bcurveTo") {
      if (odd) {
        points.push(point(operation.data[0], operation.data[1]));
        points.push(point(operation.data[2], operation.data[3]));
        points.push(point(operation.data[4], operation.data[5]));
      }
    } else if (operation.op === "lineTo") {
      if (odd) {
        points.push(point(operation.data[0], operation.data[1]));
      }
    }
  }

  const polygonPoints = pointsOnBezierCurves(points, 10, 5).map((p) =>
    transform(p as Point),
  ) as Point[];

  return {
    type: "polygon",
    data: polygonFromPoints<Point>(polygonPoints),
  };
};

/**
 * Determine intersection of a rectangular shaped element and a
 * line segment.
 *
 * @param element The rectangular element to test against
 * @param segment The segment intersecting the element
 * @param gap Optional value to inflate the shape before testing
 * @returns An array of intersections
 */
// TODO: Replace with final rounded rectangle code
export const segmentIntersectRectangleElement = <
  Point extends LocalPoint | GlobalPoint,
>(
  element: ExcalidrawBindableElement,
  s: Segment<Point>,
  gap: number = 0,
): Point[] => {
  const bounds = [
    element.x - gap,
    element.y - gap,
    element.x + element.width + gap,
    element.y + element.height + gap,
  ];
  const center = point(
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  );

  return [
    segment(
      pointRotateRads(point(bounds[0], bounds[1]), center, element.angle),
      pointRotateRads(point(bounds[2], bounds[1]), center, element.angle),
    ),
    segment(
      pointRotateRads(point(bounds[2], bounds[1]), center, element.angle),
      pointRotateRads(point(bounds[2], bounds[3]), center, element.angle),
    ),
    segment(
      pointRotateRads(point(bounds[2], bounds[3]), center, element.angle),
      pointRotateRads(point(bounds[0], bounds[3]), center, element.angle),
    ),
    segment(
      pointRotateRads(point(bounds[0], bounds[3]), center, element.angle),
      pointRotateRads(point(bounds[0], bounds[1]), center, element.angle),
    ),
  ]
    .map((l) => segmentsIntersectAt(s, l))
    .filter((i): i is Point => !!i);
};
