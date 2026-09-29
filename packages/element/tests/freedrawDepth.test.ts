import { pointFrom, type LocalPoint } from "@excalidraw/math";
import * as stock from "perfect-freehand";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import {
  ShapeCache,
  getFreedrawOutlinePoints,
  getFreedrawStrokeCenterPoints,
} from "../src";
import * as vendored from "../src/perfectFreehand";

import type { ExcalidrawFreeDrawElement } from "../src/types";

// A stroke as drawn a thousandfold zoomed in: 0.04 units long, with a pen
// scaled to match.
const tinyStroke = () =>
  API.createElement({
    type: "freedraw",
    strokeWidth: 0.001,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(0.013, 0.004),
      pointFrom<LocalPoint>(0.027, 0.004),
      pointFrom<LocalPoint>(0.04, 0),
    ],
  }) as ExcalidrawFreeDrawElement;

const pathCoordinates = (path: string) =>
  path.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number);

describe("freedraw path precision", () => {
  it("keeps every outline coordinate at full precision", () => {
    const element = tinyStroke();
    const path = ShapeCache.generateElementShape(element, null).at(-1);
    const outline = getFreedrawOutlinePoints(element);
    expect(typeof path).toBe("string");
    expect(pathCoordinates(path as string).slice(0, 2)).toEqual(outline[0]);
    expect(new Set(pathCoordinates(path as string)).size).toBeGreaterThan(8);
  });
});

// A peak in the middle of a stroke drawn with a pen of `strokeWidth`, as a
// fraction of the pen's reach: how far the outline passes from the
// centerline's highest point.
const outlineMissAtPeak = (strokeWidth: number, length: number) => {
  const element = API.createElement({
    type: "freedraw",
    strokeWidth,
    points: Array.from({ length: 21 }, (_, i) =>
      pointFrom<LocalPoint>(
        (i / 20) * length,
        Math.sin((i / 20) * Math.PI) * length * 0.3,
      ),
    ),
  }) as ExcalidrawFreeDrawElement;
  const peak = Math.max(
    ...getFreedrawStrokeCenterPoints(element).map(([, y]) => y),
  );
  const outlineTop = Math.max(
    ...getFreedrawOutlinePoints(element).map(([, y]) => y),
  );
  return Math.abs(outlineTop - peak) / (strokeWidth * 4.25);
};

describe("freedraw drawn deep in a zoom", () => {
  it("keeps the body of a stroke shorter than 3 units", () => {
    expect(outlineMissAtPeak(0.001, 0.5)).toBeLessThan(1);
  });

  it("draws a pen finer than a hundredth of a unit at its own width", () => {
    const element = tinyStroke();
    const reach = Math.max(
      ...getFreedrawOutlinePoints(element).map(([x, y]) =>
        Math.min(
          ...getFreedrawStrokeCenterPoints(element).map(([cx, cy]) =>
            Math.hypot(x - cx, y - cy),
          ),
        ),
      ),
    );
    expect(reach).toBeLessThanOrEqual(element.strokeWidth * 4.25);
  });

  it("keeps the shape of strokes drawn at 1x", () => {
    expect(outlineMissAtPeak(1, 100)).toBeLessThan(1);
  });
});

const DEEP_ZOOM = 100_000;

/**
 * An arch drawn at `zoom` with the thinnest pen scaled to it, `span` board
 * units wide and a third as tall.
 */
const arch = (span: number, zoom: number) =>
  API.createElement({
    type: "freedraw",
    strokeWidth: 1 / zoom,
    points: Array.from({ length: 21 }, (_, i) =>
      pointFrom<LocalPoint>(
        (i / 20) * span,
        Math.sin((i / 20) * Math.PI) * (span / 3),
      ),
    ),
  }) as ExcalidrawFreeDrawElement;

const svgPath = (element: ExcalidrawFreeDrawElement) =>
  ShapeCache.generateElementShape(element, null).at(-1) as string;

const pathPoints = (path: string) => {
  const coordinates = pathCoordinates(path);
  return Array.from({ length: coordinates.length / 2 }, (_, i) => [
    coordinates[2 * i],
    coordinates[2 * i + 1],
  ]);
};

const extent = (values: number[]) => Math.max(...values) - Math.min(...values);

describe("a stroke a thousandth of a unit wide, drawn at 100,000x", () => {
  const element = () => arch(0.001, DEEP_ZOOM);
  const size = (1 / DEEP_ZOOM) * 4.25;

  it("keeps its coordinates past two decimals", () => {
    const xs = pathPoints(svgPath(element())).map(([x]) => x);
    expect(new Set(xs.map((x) => Math.round(x * 100))).size).toBeLessThan(
      new Set(xs).size,
    );
  });

  it("keeps its body, reaching its peak", () => {
    const peak = Math.max(
      ...getFreedrawStrokeCenterPoints(element()).map(([, y]) => y),
    );
    const top = Math.max(...pathPoints(svgPath(element())).map(([, y]) => y));
    expect(Math.abs(top - peak) / size).toBeLessThan(1);
  });

  it("is no thicker than the pen", () => {
    const center = getFreedrawStrokeCenterPoints(element()).map(([, y]) => y);
    const outline = pathPoints(svgPath(element())).map(([, y]) => y);
    expect(extent(outline)).toBeLessThanOrEqual(extent(center) + size);
  });
});

describe("strokes drawn at 1x", () => {
  // mulberry32: the same strokes every run.
  const random = (() => {
    let seed = 0x5eed;
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const strokes = Array.from({ length: 200 }, (_, i) => {
    const length = 2 + Math.floor(random() * 40);
    let x = random() * 100;
    let y = random() * 100;
    const points = Array.from({ length }, () => {
      x += (random() - 0.5) * 20;
      y += (random() - 0.5) * 20;
      return [x, y, random()];
    });
    return {
      points,
      size: 4.25 * [1, 1, 2, 4][i % 4],
      simulatePressure: i % 2 === 0,
    };
  });

  // Excalidraw's options for a pressure-sensitive stroke.
  const options = (size: number, simulatePressure: boolean) => ({
    simulatePressure,
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t: number) => Math.sin((t * Math.PI) / 2),
    last: true,
  });

  it("get exactly perfect-freehand 1.2.0's outline from the thinnest pen up", () => {
    const outlines = (freehand: Pick<typeof vendored, "getStroke">) =>
      strokes.map(({ points, size, simulatePressure }) =>
        freehand.getStroke(points, options(size, simulatePressure)),
      );
    expect(outlines(vendored)).toEqual(outlines(stock));
  });
});
