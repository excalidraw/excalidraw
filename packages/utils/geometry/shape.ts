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

import { getElementAbsoluteCoords } from "../../excalidraw/element";
import type {
  ElementsMap,
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
import { angleToDegrees, close, pointAdd, pointRotate } from "./geometry";
import { pointsOnBezierCurves } from "points-on-curve";
import type { Drawable, Op } from "roughjs/bin/core";

// a point is specified by its coordinate (x, y)
export type Point = [number, number];
export type Vector = Point;

// a line (segment) is defined by two endpoints
export type Line = [Point, Point];

// a polyline (made up term here) is a line consisting of other line segments
// this corresponds to a straight line element in the editor but it could also
// be used to model other elements
export type Polyline = Line[];

// cubic bezier curve with four control points
export type Curve = [Point, Point, Point, Point];

// a polycurve is a curve consisting of ther curves, this corresponds to a complex
// curve on the canvas
export type Polycurve = Curve[];

// a polygon is a closed shape by connecting the given points
// rectangles and diamonds are modelled by polygons
export type Polygon = Point[];

// an ellipse is specified by its center, angle, and its major and minor axes
// but for the sake of simplicity, we've used halfWidth and halfHeight instead
// in replace of semi major and semi minor axes
export type Ellipse = {
  center: Point;
  angle: number;
  halfWidth: number;
  halfHeight: number;
};

export type GeometricShape =
  | {
      type: "line";
      data: Line;
    }
  | {
      type: "polygon";
      data: Polygon;
    }
  | {
      type: "curve";
      data: Curve;
    }
  | {
      type: "ellipse";
      data: Ellipse;
    }
  | {
      type: "polyline";
      data: Polyline;
    }
  | {
      type: "polycurve";
      data: Polycurve;
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
export const getPolygonShape = (
  element: RectangularElement,
): GeometricShape => {
  const { angle, width, height, x, y } = element;
  const angleInDegrees = angleToDegrees(angle);
  const cx = x + width / 2;
  const cy = y + height / 2;

  const center: Point = [cx, cy];

  let data: Polygon = [];

  if (element.type === "diamond") {
    data = [
      pointRotate([cx, y], angleInDegrees, center),
      pointRotate([x + width, cy], angleInDegrees, center),
      pointRotate([cx, y + height], angleInDegrees, center),
      pointRotate([x, cy], angleInDegrees, center),
    ] as Polygon;
  } else {
    data = [
      pointRotate([x, y], angleInDegrees, center),
      pointRotate([x + width, y], angleInDegrees, center),
      pointRotate([x + width, y + height], angleInDegrees, center),
      pointRotate([x, y + height], angleInDegrees, center),
    ] as Polygon;
  }

  return {
    type: "polygon",
    data,
  };
};

// return the selection box for an element, possibly rotated as well
export const getSelectionBoxShape = (
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

  const angleInDegrees = angleToDegrees(element.angle);
  const center: Point = [cx, cy];
  const topLeft = pointRotate([x1, y1], angleInDegrees, center);
  const topRight = pointRotate([x2, y1], angleInDegrees, center);
  const bottomLeft = pointRotate([x1, y2], angleInDegrees, center);
  const bottomRight = pointRotate([x2, y2], angleInDegrees, center);

  return {
    type: "polygon",
    data: [topLeft, topRight, bottomRight, bottomLeft],
  } as GeometricShape;
};

// ellipse
export const getEllipseShape = (
  element: ExcalidrawEllipseElement,
): GeometricShape => {
  const { width, height, angle, x, y } = element;

  return {
    type: "ellipse",
    data: {
      center: [x + width / 2, y + height / 2],
      angle,
      halfWidth: width / 2,
      halfHeight: height / 2,
    },
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
export const getCurveShape = (
  roughShape: Drawable,
  startingPoint: Point = [0, 0],
  angleInRadian: number,
  center: Point,
): GeometricShape => {
  const transform = (p: Point) =>
    pointRotate(
      [p[0] + startingPoint[0], p[1] + startingPoint[1]],
      angleToDegrees(angleInRadian),
      center,
    );

  const ops = getCurvePathOps(roughShape);
  const polycurve: Polycurve = [];
  let p0: Point = [0, 0];

  for (const op of ops) {
    if (op.op === "move") {
      p0 = transform(op.data as Point);
    }
    if (op.op === "bcurveTo") {
      const p1: Point = transform([op.data[0], op.data[1]]);
      const p2: Point = transform([op.data[2], op.data[3]]);
      const p3: Point = transform([op.data[4], op.data[5]]);
      polycurve.push([p0, p1, p2, p3]);
      p0 = p3;
    }
  }

  return {
    type: "polycurve",
    data: polycurve,
  };
};

const polylineFromPoints = (points: Point[]) => {
  let previousPoint = points[0];
  const polyline: Polyline = [];

  for (let i = 1; i < points.length; i++) {
    const nextPoint = points[i];
    polyline.push([previousPoint, nextPoint]);
    previousPoint = nextPoint;
  }

  return polyline;
};

export const getFreedrawShape = (
  element: ExcalidrawFreeDrawElement,
  center: Point,
  isClosed: boolean = false,
): GeometricShape => {
  const angle = angleToDegrees(element.angle);
  const transform = (p: Point) =>
    pointRotate(pointAdd(p, [element.x, element.y] as Point), angle, center);

  const polyline = polylineFromPoints(
    element.points.map((p) => transform(p as Point)),
  );

  return isClosed
    ? {
        type: "polygon",
        data: close(polyline.flat()) as Polygon,
      }
    : {
        type: "polyline",
        data: polyline,
      };
};

export const getClosedCurveShape = (
  element: ExcalidrawLinearElement,
  roughShape: Drawable,
  startingPoint: Point = [0, 0],
  angleInRadian: number,
  center: Point,
): GeometricShape => {
  const transform = (p: Point) =>
    pointRotate(
      [p[0] + startingPoint[0], p[1] + startingPoint[1]],
      angleToDegrees(angleInRadian),
      center,
    );

  if (element.roundness === null) {
    return {
      type: "polygon",
      data: close(element.points.map((p) => transform(p as Point))),
    };
  }

  const ops = getCurvePathOps(roughShape);

  const points: Point[] = [];
  let odd = false;
  for (const operation of ops) {
    if (operation.op === "move") {
      odd = !odd;
      if (odd) {
        points.push([operation.data[0], operation.data[1]]);
      }
    } else if (operation.op === "bcurveTo") {
      if (odd) {
        points.push([operation.data[0], operation.data[1]]);
        points.push([operation.data[2], operation.data[3]]);
        points.push([operation.data[4], operation.data[5]]);
      }
    } else if (operation.op === "lineTo") {
      if (odd) {
        points.push([operation.data[0], operation.data[1]]);
      }
    }
  }

  const polygonPoints = pointsOnBezierCurves(points, 10, 5).map((p) =>
    transform(p),
  );

  return {
    type: "polygon",
    data: polygonPoints,
  };
};
