/**
 * convert excalidraw elements into geometric shapes
 */

import {
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawIframeElement,
  ExcalidrawImageElement,
  ExcalidrawRectangleElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
} from "../../excalidraw/element/types";
import { angleToDegrees, close, pointAdd, pointRotate } from "./geometry";
import { Drawable, Op } from "roughjs/bin/core";

export type Point = [number, number];
export type Vector = Point;
export type Line = [Point, Point];
export type Polyline = Line[];
// cubic bezier curve with four control points
export type Curve = [Point, Point, Point, Point];
export type Polycurve = Curve[];
export type Polygon = Point[];
export type Ellipse = {
  center: Point;
  angle: number;
  halfWidth: number;
  halfHeight: number;
};
export type Shape =
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
export const getPolygonShape = (element: RectangularElement): Shape => {
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

// ellipse
export const getEllipseShape = (element: ExcalidrawEllipseElement): Shape => {
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
): Shape => {
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
): Shape => {
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
