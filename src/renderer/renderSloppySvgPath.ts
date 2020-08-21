import { parsePath, normalize, absolutize } from "path-data-parser";
import { curveToBezier } from "points-on-curve/lib/curve-to-bezier.js";
import { Op, OpSet, ResolvedOptions } from "roughjs/bin/core";

import { randomInteger, reseed } from "../random";
import { Point } from "../types";

const random = () => randomInteger() / 2 ** 31;

const getSloppyLine = (
  x0: number,
  y0: number,
  x: number,
  y: number,
  roughness: number,
): number[][] => {
  const delta = 0.015 * Math.sqrt((x - x0) ** 2 + (y - y0) ** 2) * roughness;
  const getRandomMiddlePoint = (fraction: number): [number, number] => [
    x0 + (x - x0) * fraction + random() * delta - delta / 2,
    y0 + (y - y0) * fraction + random() * delta - delta / 2,
  ];
  const bcurve = curveToBezier([
    [x0, y0],
    getRandomMiddlePoint(0.25),
    getRandomMiddlePoint(0.5),
    getRandomMiddlePoint(0.75),
    [x, y],
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

const splitBezier = (
  [x0, y0, x1, y1, x2, y2, x, y]: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ],
  fraction: number,
): [
  [number, number, number, number, number, number, number, number],
  [number, number, number, number, number, number, number, number],
] => {
  // https://stackoverflow.com/a/2614028
  const xx01 = (1 - fraction) * x0 + fraction * x1;
  const yy01 = (1 - fraction) * y0 + fraction * y1;
  const xx12 = (1 - fraction) * x1 + fraction * x2;
  const yy12 = (1 - fraction) * y1 + fraction * y2;
  const xx23 = (1 - fraction) * x2 + fraction * x;
  const yy23 = (1 - fraction) * y2 + fraction * y;
  const xx0112 = (1 - fraction) * xx01 + fraction * xx12;
  const yy0112 = (1 - fraction) * yy01 + fraction * yy12;
  const xx1223 = (1 - fraction) * xx12 + fraction * xx23;
  const yy1223 = (1 - fraction) * yy12 + fraction * yy23;
  const xx = (1 - fraction) * xx0112 + fraction * xx1223;
  const yy = (1 - fraction) * yy0112 + fraction * yy1223;
  return [
    [x0, y0, xx01, yy01, xx0112, yy0112, xx, yy],
    [xx, yy, xx1223, yy1223, xx23, yy23, x, y],
  ];
};

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
  const delta = 0.02 * Math.sqrt((x - x0) ** 2 + (y - y0) ** 2) * roughness;
  const [p01, pp09] = splitBezier([x0, y0, x1, y1, x2, y2, x, y], 0.1);
  const [p03, pp07] = splitBezier(pp09, 0.2 / 0.9);
  const [p05, pp05] = splitBezier(pp07, 0.2 / 0.7);
  const [p07, pp03] = splitBezier(pp05, 0.2 / 0.5);
  const [p09, pp01] = splitBezier(pp03, 0.2 / 0.3);
  const rand03x = random() * delta - delta / 2;
  const rand03y = random() * delta - delta / 2;
  p03[4] += rand03x;
  p03[5] += rand03y;
  p03[6] += rand03x;
  p03[7] += rand03y;
  p05[2] += rand03x;
  p05[3] += rand03y;
  const rand05x = random() * delta - delta / 2;
  const rand05y = random() * delta - delta / 2;
  p05[4] += rand05x;
  p05[5] += rand05y;
  p05[6] += rand05x;
  p05[7] += rand05y;
  p07[2] += rand05x;
  p07[3] += rand05y;
  const rand07x = random() * delta - delta / 2;
  const rand07y = random() * delta - delta / 2;
  p07[4] += rand07x;
  p07[5] += rand07y;
  p07[6] += rand07x;
  p07[7] += rand07y;
  p09[2] += rand07x;
  p09[3] += rand07y;
  const arr = [
    p01.slice(2),
    p03.slice(2),
    p05.slice(2),
    p07.slice(2),
    p09.slice(2),
    pp01.slice(2),
  ];
  return arr;
};

export const renderSloppySvgPath = (
  svgPath: string,
  options: ResolvedOptions,
): OpSet => {
  reseed(options.seed);
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
        const arr = getSloppyLine(
          current[0],
          current[1],
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
        const arr = getSloppyLine(
          current[0],
          current[1],
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
