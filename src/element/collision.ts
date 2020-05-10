import {
  distanceBetweenPointAndSegment,
  isPathALoop,
  rotate,
  isPointInPolygon,
} from "../math";
import { pointsOnBezierCurves } from "points-on-curve";

import { NonDeletedExcalidrawElement } from "./types";

import {
  getDiamondPoints,
  getElementAbsoluteCoords,
  getCurvePathOps,
} from "./bounds";
import { Point } from "../types";
import { Drawable } from "roughjs/bin/core";
import { AppState } from "../types";
import { getShapeForElement } from "../renderer/renderElement";
import { isLinearElement } from "./typeChecks";

function isElementDraggableFromInside(
  element: NonDeletedExcalidrawElement,
  appState: AppState,
): boolean {
  const dragFromInside =
    element.backgroundColor !== "transparent" ||
    appState.selectedElementIds[element.id];
  if (element.type === "line" || element.type === "draw") {
    return dragFromInside && isPathALoop(element.points);
  }
  return dragFromInside;
}

export function hitTest(
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
  zoom: number,
): boolean {
  // For shapes that are composed of lines, we only enable point-selection when the distance
  // of the click is less than x pixels of any of the lines that the shape is composed of
  const lineThreshold = 10 / zoom;

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  // reverse rotate the pointer
  [x, y] = rotate(x, y, cx, cy, -element.angle);

  if (element.type === "ellipse") {
    // https://stackoverflow.com/a/46007540/232122
    const px = Math.abs(x - element.x - element.width / 2);
    const py = Math.abs(y - element.y - element.height / 2);

    let tx = 0.707;
    let ty = 0.707;

    const a = Math.abs(element.width) / 2;
    const b = Math.abs(element.height) / 2;

    [0, 1, 2, 3].forEach((x) => {
      const xx = a * tx;
      const yy = b * ty;

      const ex = ((a * a - b * b) * tx ** 3) / a;
      const ey = ((b * b - a * a) * ty ** 3) / b;

      const rx = xx - ex;
      const ry = yy - ey;

      const qx = px - ex;
      const qy = py - ey;

      const r = Math.hypot(ry, rx);
      const q = Math.hypot(qy, qx);

      tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
      ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
      const t = Math.hypot(ty, tx);
      tx /= t;
      ty /= t;
    });

    if (isElementDraggableFromInside(element, appState)) {
      return (
        a * tx - (px - lineThreshold) >= 0 && b * ty - (py - lineThreshold) >= 0
      );
    }
    return Math.hypot(a * tx - px, b * ty - py) < lineThreshold;
  } else if (element.type === "rectangle") {
    if (isElementDraggableFromInside(element, appState)) {
      return (
        x > x1 - lineThreshold &&
        x < x2 + lineThreshold &&
        y > y1 - lineThreshold &&
        y < y2 + lineThreshold
      );
    }

    // (x1, y1) --A-- (x2, y1)
    //    |D             |B
    // (x1, y2) --C-- (x2, y2)
    return (
      distanceBetweenPointAndSegment(x, y, x1, y1, x2, y1) < lineThreshold || // A
      distanceBetweenPointAndSegment(x, y, x2, y1, x2, y2) < lineThreshold || // B
      distanceBetweenPointAndSegment(x, y, x2, y2, x1, y2) < lineThreshold || // C
      distanceBetweenPointAndSegment(x, y, x1, y2, x1, y1) < lineThreshold // D
    );
  } else if (element.type === "diamond") {
    x -= element.x;
    y -= element.y;
    let [
      topX,
      topY,
      rightX,
      rightY,
      bottomX,
      bottomY,
      leftX,
      leftY,
    ] = getDiamondPoints(element);

    if (isElementDraggableFromInside(element, appState)) {
      // TODO: remove this when we normalize coordinates globally
      if (topY > bottomY) {
        [bottomY, topY] = [topY, bottomY];
      }
      if (rightX < leftX) {
        [leftX, rightX] = [rightX, leftX];
      }

      topY -= lineThreshold;
      bottomY += lineThreshold;
      leftX -= lineThreshold;
      rightX += lineThreshold;

      // all deltas should be < 0. Delta > 0 indicates it's on the outside side
      //  of the line.
      //
      //          (topX, topY)
      //     D  /             \ A
      //      /               \
      //  (leftX, leftY)  (rightX, rightY)
      //    C \               / B
      //      \              /
      //      (bottomX, bottomY)
      //
      // https://stackoverflow.com/a/2752753/927631
      return (
        // delta from line D
        (leftX - topX) * (y - leftY) - (leftX - x) * (topY - leftY) <= 0 &&
        // delta from line A
        (topX - rightX) * (y - rightY) - (x - rightX) * (topY - rightY) <= 0 &&
        // delta from line B
        (rightX - bottomX) * (y - bottomY) -
          (x - bottomX) * (rightY - bottomY) <=
          0 &&
        // delta from line C
        (bottomX - leftX) * (y - leftY) - (x - leftX) * (bottomY - leftY) <= 0
      );
    }

    return (
      distanceBetweenPointAndSegment(x, y, topX, topY, rightX, rightY) <
        lineThreshold ||
      distanceBetweenPointAndSegment(x, y, rightX, rightY, bottomX, bottomY) <
        lineThreshold ||
      distanceBetweenPointAndSegment(x, y, bottomX, bottomY, leftX, leftY) <
        lineThreshold ||
      distanceBetweenPointAndSegment(x, y, leftX, leftY, topX, topY) <
        lineThreshold
    );
  } else if (isLinearElement(element)) {
    if (!getShapeForElement(element)) {
      return false;
    }
    const shape = getShapeForElement(element) as Drawable[];

    if (
      x < x1 - lineThreshold ||
      y < y1 - lineThreshold ||
      x > x2 + lineThreshold ||
      y > y2 + lineThreshold
    ) {
      return false;
    }

    const relX = x - element.x;
    const relY = y - element.y;

    if (isElementDraggableFromInside(element, appState)) {
      const hit = shape.some((subshape) =>
        hitTestCurveInside(subshape, relX, relY, lineThreshold),
      );
      if (hit) {
        return true;
      }
    }

    // hit thest all "subshapes" of the linear element
    return shape.some((subshape) =>
      hitTestRoughShape(subshape, relX, relY, lineThreshold),
    );
  } else if (element.type === "text") {
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  } else if (element.type === "selection") {
    console.warn("This should not happen, we need to investigate why it does.");
    return false;
  }
  throw new Error(`Unimplemented type ${element.type}`);
}

const pointInBezierEquation = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  [mx, my]: Point,
  lineThreshold: number,
) => {
  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t: number, idx: number) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // go through t in increments of 0.01
  let t = 0;
  while (t <= 1.0) {
    const tx = equation(t, 0);
    const ty = equation(t, 1);

    const diff = Math.sqrt(Math.pow(tx - mx, 2) + Math.pow(ty - my, 2));

    if (diff < lineThreshold) {
      return true;
    }

    t += 0.01;
  }

  return false;
};

const hitTestCurveInside = (
  drawable: Drawable,
  x: number,
  y: number,
  lineThreshold: number,
) => {
  const ops = getCurvePathOps(drawable);
  const points: Point[] = [];
  for (const operation of ops) {
    if (operation.op === "move") {
      if (points.length) {
        break;
      }
      points.push([operation.data[0], operation.data[1]]);
    } else if (operation.op === "bcurveTo") {
      points.push([operation.data[0], operation.data[1]]);
      points.push([operation.data[2], operation.data[3]]);
      points.push([operation.data[4], operation.data[5]]);
    }
  }
  if (points.length >= 4) {
    const polygonPoints = pointsOnBezierCurves(points as any, 10, 5);
    return isPointInPolygon(polygonPoints, x, y);
  }
  return false;
};

const hitTestRoughShape = (
  drawable: Drawable,
  x: number,
  y: number,
  lineThreshold: number,
) => {
  // read operations from first opSet
  const ops = getCurvePathOps(drawable);

  // set start position as (0,0) just in case
  // move operation does not exist (unlikely but it is worth safekeeping it)
  let currentP: Point = [0, 0];

  return ops.some(({ op, data }, idx) => {
    // There are only four operation types:
    // move, bcurveTo, lineTo, and curveTo
    if (op === "move") {
      // change starting point
      currentP = (data as unknown) as Point;
      // move operation does not draw anything; so, it always
      // returns false
    } else if (op === "bcurveTo") {
      // create points from bezier curve
      // bezier curve stores data as a flattened array of three positions
      // [x1, y1, x2, y2, x3, y3]
      const p1 = [data[0], data[1]] as Point;
      const p2 = [data[2], data[3]] as Point;
      const p3 = [data[4], data[5]] as Point;

      const p0 = currentP;
      currentP = p3;

      // check if points are on the curve
      // cubic bezier curves require four parameters
      // the first parameter is the last stored position (p0)
      const retVal = pointInBezierEquation(
        p0,
        p1,
        p2,
        p3,
        [x, y],
        lineThreshold,
      );

      // set end point of bezier curve as the new starting point for
      // upcoming operations as each operation is based on the last drawn
      // position of the previous operation
      return retVal;
    } else if (op === "lineTo") {
      // TODO: Implement this
    } else if (op === "qcurveTo") {
      // TODO: Implement this
    }

    return false;
  });
};
