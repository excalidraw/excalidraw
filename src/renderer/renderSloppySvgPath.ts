import { parsePath, normalize, absolutize } from "path-data-parser";
import { pointsOnBezierCurves } from "points-on-curve";
import { curveToBezier } from "points-on-curve/lib/curve-to-bezier.js";
import { Op, OpSet, ResolvedOptions } from "roughjs/bin/core";

import { Point } from "../types";

const getSloppyCurve = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
  roughness: number,
): number[][] => {
  const points = pointsOnBezierCurves(
    [
      [x0, y0],
      [x1, y1],
      [x2, y2],
      [x, y],
    ],
    1.0,
  );
  const diff = 2 * roughness;
  points.forEach((point, index) => {
    if (index > 1 && index < points.length - 2) {
      point[0] += Math.random() * diff - diff / 2;
      point[1] += Math.random() * diff - diff / 2;
    }
  });
  const p25 = Math.round(points.length * 0.25);
  if (p25 < 3) {
    return [[x1, y1, x2, y2, x, y]];
  }
  const bcurve = curveToBezier([
    points[0],
    points[1],
    points[p25],
    points[p25 * 2],
    points[p25 * 3],
    points[points.length - 2],
    points[points.length - 1],
  ]);
  const arr: number[][] = [];
  for (let i = 1; i + 2 < bcurve.length; i += 3) {
    arr.push([
      bcurve[i][0],
      bcurve[i][1],
      bcurve[i + 1][0],
      bcurve[i + 1][1],
      bcurve[i + 2][0],
      bcurve[i + 2][1],
    ]);
  }
  return arr;
};

export const renderSloppySvgPath = (
  svgPath: string,
  options: ResolvedOptions,
): OpSet => {
  const segments = normalize(absolutize(parsePath(svgPath)));
  const ops: Op[] = [];
  let first: Point = [0, 0];
  let current: Point = [0, 0];
  for (const { key, data } of segments) {
    switch (key) {
      case "M": {
        ops.push({ op: "move", data });
        current = [data[0], data[1]];
        first = [data[0], data[1]];
        break;
      }
      case "L": {
        const cx = (current[0] + data[0]) / 2;
        const cy = (current[1] + data[1]) / 2;
        const arr = getSloppyCurve(
          current[0],
          current[1],
          cx,
          cy,
          cx,
          cy,
          data[0],
          data[1],
          options.roughness,
        );
        arr.forEach((data) => {
          ops.push({
            op: "bcurveTo",
            data,
          });
        });
        current = [data[0], data[1]];
        break;
      }
      case "C": {
        const [x1, y1, x2, y2, x, y] = data;
        const arr = getSloppyCurve(
          current[0],
          current[1],
          x1,
          y1,
          x2,
          y2,
          x,
          y,
          options.roughness,
        );
        arr.forEach((data) => {
          ops.push({
            op: "bcurveTo",
            data,
          });
        });
        current = [x, y];
        break;
      }
      case "Z": {
        const cx = (current[0] + first[0]) / 2;
        const cy = (current[1] + first[1]) / 2;
        const arr = getSloppyCurve(
          current[0],
          current[1],
          cx,
          cy,
          cx,
          cy,
          first[0],
          first[1],
          options.roughness,
        );
        arr.forEach((data) => {
          ops.push({
            op: "bcurveTo",
            data,
          });
        });
        current = [first[0], first[1]];
        break;
      }
    }
  }
  return { type: "path", ops };
};
