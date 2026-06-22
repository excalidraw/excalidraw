import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  terraformMinimapBounds,
  terraformMinimapDims,
  terraformMinimapDrawStep,
} from "./TerraformMinimap";

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
): ExcalidrawElement =>
  ({
    id: `r-${x}-${y}-${width}-${height}`,
    type: "rectangle",
    x,
    y,
    width,
    height,
    angle: 0,
    isDeleted: false,
  } as unknown as ExcalidrawElement);

describe("terraformMinimapBounds", () => {
  it("returns null for an empty scene (getCommonBounds → Infinity guard)", () => {
    expect(terraformMinimapBounds([])).toBeNull();
  });

  it("returns null for a degenerate zero-area scene (no divide-by-zero)", () => {
    // a single zero-size element collapses to a point
    expect(terraformMinimapBounds([rect(10, 10, 0, 0)])).toBeNull();
  });

  it("returns the common bounds of a real scene", () => {
    const bounds = terraformMinimapBounds([
      rect(0, 0, 100, 50),
      rect(200, 100, 100, 100),
    ]);
    expect(bounds).toEqual([0, 0, 300, 200]);
  });
});

describe("terraformMinimapDims", () => {
  it("returns null when there are no bounds", () => {
    expect(terraformMinimapDims(null)).toBeNull();
  });

  it("preserves aspect ratio within the cap for a wide scene", () => {
    // 1000x250 scene → width-bound at 200 → scale 0.2 → 200x60 (min side floor)
    const dims = terraformMinimapDims([0, 0, 1000, 250]);
    expect(dims).not.toBeNull();
    expect(dims!.scale).toBeCloseTo(0.2);
    expect(dims!.width).toBe(200);
    // 250 * 0.2 = 50, floored to MINIMAP_MIN_SIDE (60)
    expect(dims!.height).toBe(60);
  });

  it("is height-bound for a tall scene", () => {
    // 100x1000 → height-bound at 150 → scale 0.15
    const dims = terraformMinimapDims([0, 0, 100, 1000]);
    expect(dims!.scale).toBeCloseTo(0.15);
    expect(dims!.height).toBe(150);
  });
});

describe("terraformMinimapDrawStep (own LOD / primitive cap)", () => {
  it("draws every element below the cap", () => {
    expect(terraformMinimapDrawStep(0)).toBe(1);
    expect(terraformMinimapDrawStep(1500)).toBe(1);
  });

  it("strides so at most the cap is drawn for a huge scene", () => {
    const count = 9000;
    const step = terraformMinimapDrawStep(count);
    expect(step).toBe(6);
    // strided draw count never exceeds the cap
    expect(Math.ceil(count / step)).toBeLessThanOrEqual(1500);
  });

  it("keeps the strided draw count under the cap just past the threshold", () => {
    const count = 1501;
    const step = terraformMinimapDrawStep(count);
    expect(step).toBe(2);
    expect(Math.ceil(count / step)).toBeLessThanOrEqual(1500);
  });
});
