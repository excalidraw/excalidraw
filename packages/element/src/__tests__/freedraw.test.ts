import { pointFrom } from "@excalidraw/math";
import { getStroke } from "perfect-freehand";

import type { LocalPoint } from "@excalidraw/math";

import {
  DEFAULT_FREEDRAW_STROKE_SHAPE,
  FREEDRAW_STROKE_SHAPES,
  getFreedrawStrokeOptions,
  normalizeFreedrawStrokeShape,
} from "../freedraw";
import { newFreeDrawElement } from "../newElement";
import { getFreedrawOutlinePoints } from "../shape";

const points = [
  pointFrom<LocalPoint>(0, 0),
  pointFrom<LocalPoint>(12, 8),
  pointFrom<LocalPoint>(24, 3),
  pointFrom<LocalPoint>(36, 14),
];
const pressures = [0.2, 0.8, 0.35, 0.9];

describe("freedraw stroke shapes", () => {
  it("defaults new elements and unknown values to Pencil", () => {
    const element = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      simulatePressure: true,
    });

    expect(element.strokeShape).toBe(DEFAULT_FREEDRAW_STROKE_SHAPE);
    expect(normalizeFreedrawStrokeShape("unknown")).toBe("pencil");
  });

  it("keeps Pencil equivalent to the pre-preset option profile", () => {
    const options = getFreedrawStrokeOptions("pencil", 2, false);

    expect(options).toMatchObject({
      simulatePressure: false,
      size: 8.5,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      last: true,
    });
    expect(options.start).toBeUndefined();
    expect(options.end).toBeUndefined();
    expect(options.easing?.(0.5)).toBeCloseTo(Math.sin(Math.PI / 4));

    const element = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      strokeWidth: 2,
      simulatePressure: false,
      points,
      pressures,
      strokeShape: "pencil",
    });
    const legacyOutline = getStroke(
      points.map(([x, y], index) => [x, y, pressures[index]]),
      {
        simulatePressure: false,
        size: 8.5,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5,
        easing: (t) => Math.sin((t * Math.PI) / 2),
        last: true,
      },
    );

    expect(getFreedrawOutlinePoints(element)).toEqual(legacyOutline);
  });

  it("resolves five distinct, bounded profiles", () => {
    const outlines = FREEDRAW_STROKE_SHAPES.map((strokeShape) => {
      const options = getFreedrawStrokeOptions(strokeShape, 2, false);
      expect(options.size).toBeGreaterThan(0);
      expect(options.thinning).toBeGreaterThanOrEqual(-1);
      expect(options.thinning).toBeLessThanOrEqual(1);
      expect(options.smoothing).toBeGreaterThanOrEqual(0);
      expect(options.smoothing).toBeLessThanOrEqual(1);
      expect(options.streamline).toBeGreaterThanOrEqual(0);
      expect(options.streamline).toBeLessThanOrEqual(1);

      return getFreedrawOutlinePoints(
        newFreeDrawElement({
          type: "freedraw",
          x: 0,
          y: 0,
          strokeWidth: 2,
          simulatePressure: false,
          points,
          pressures,
          strokeShape,
        }),
      );
    });

    expect(
      new Set(outlines.map((outline) => JSON.stringify(outline))).size,
    ).toBe(FREEDRAW_STROKE_SHAPES.length);

    const pencil = getFreedrawStrokeOptions("pencil", 2, false);
    const marker = getFreedrawStrokeOptions("marker", 2, false);
    const brush = getFreedrawStrokeOptions("brush", 2, false);
    const technical = getFreedrawStrokeOptions("technical", 2, false);
    const calligraphy = getFreedrawStrokeOptions("calligraphy", 2, false);

    expect(marker.size!).toBeGreaterThan(pencil.size!);
    expect(marker.thinning!).toBeLessThan(pencil.thinning!);
    expect(brush.start?.taper).toBeTruthy();
    expect(brush.end?.taper).toBeTruthy();
    expect(technical.thinning).toBe(0);
    expect(calligraphy.thinning!).toBeGreaterThan(brush.thinning!);
    expect(calligraphy.end?.taper as number).toBeGreaterThan(
      brush.end?.taper as number,
    );
  });
});
