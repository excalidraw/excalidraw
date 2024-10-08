import type { Drawable } from "roughjs/bin/core";
import {
  degrees,
  degreesToRadians,
  pointFrom,
  pointFromArray,
  pointRotateRads,
  radians,
  type Degrees,
} from "../../math";
import type { Arrowhead, ExcalidrawLinearElement } from "./types";
import { getCurvePathOps } from "../../utils/geometry/shape";
import { invariant } from "../utils";

/** @returns number in degrees */
const getArrowheadAngle = (arrowhead: Arrowhead): Degrees => {
  switch (arrowhead) {
    case "bar":
      return degrees(90);
    case "arrow":
      return degrees(20);
    default:
      return degrees(25);
  }
};

/** @returns number in pixels */
const getArrowheadSize = (arrowhead: Arrowhead): number => {
  switch (arrowhead) {
    case "arrow":
      return 25;
    case "diamond":
    case "diamond_outline":
      return 12;
    default:
      return 15;
  }
};

export const getArrowheadPoints = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
) => {
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

  // Return points
  const [x3, y3] = pointRotateRads(
    pointFrom(xs, ys),
    pointFrom(x2, y2),
    radians((-angle * Math.PI) / 180),
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
        radians(Math.atan2(py - y2, px - x2)),
      );
    } else {
      const [px, py] =
        element.points.length > 1
          ? element.points[element.points.length - 2]
          : [0, 0];

      [ox, oy] = pointRotateRads(
        pointFrom(x2 - minSize * 2, y2),
        pointFrom(x2, y2),
        radians(Math.atan2(y2 - py, x2 - px)),
      );
    }

    return [x2, y2, x3, y3, ox, oy, x4, y4];
  }

  return [x2, y2, x3, y3, x4, y4];
};
