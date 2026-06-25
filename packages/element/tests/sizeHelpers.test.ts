import { vi, describe, it, expect } from "vitest";
import { getPerfectElementSize, isInvisiblySmallElement } from "../src/sizeHelpers";

const EPSILON_DIGITS = 3;

vi.mock(
  "@excalidraw/common",
  //@ts-ignore
  async (importOriginal) => {
    const module: any = await importOriginal();
    return { ...module };
  },
);

describe("getPerfectElementSize", () => {
  it("should return height:0 if `elementType` is line and locked angle is 0", () => {
    const { height, width } = getPerfectElementSize("line", 149, 10);
    expect(width).toBeCloseTo(149, EPSILON_DIGITS);
    expect(height).toBeCloseTo(0, EPSILON_DIGITS);
  });

  it("should return width:0 if `elementType` is line and locked angle is 90 deg (Math.PI/2)", () => {
    const { height, width } = getPerfectElementSize("line", 10, 140);
    expect(width).toBeCloseTo(0, EPSILON_DIGITS);
    expect(height).toBeCloseTo(140, EPSILON_DIGITS);
  });
});


// getPerfectElementSize

describe("getPerfectElementSize - extra cases", () => {
  it("rectangle should maintain width and height", () => {
    const { width, height } = getPerfectElementSize("rectangle", 100, 50);
    expect(width).toBeCloseTo(100, EPSILON_DIGITS);
    expect(height).toBeCloseTo(50, EPSILON_DIGITS);
  });

  it("ellipse should maintain width/height ratio", () => {
    const { width, height } = getPerfectElementSize("ellipse", 200, 100);
    expect(width / height).toBeCloseTo(2, EPSILON_DIGITS);
  });

  it("diamond should generate positive values", () => {
    const { width, height } = getPerfectElementSize("diamond", 75, 75);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("arrow should return valid size", () => {
    const { width, height } = getPerfectElementSize("arrow", 150, 0);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThanOrEqual(0);
  });

  it("negative values should be maintained", () => {
    const { width, height } = getPerfectElementSize("rectangle", -120, -80);
    expect(width).toBe(-120);
    expect(height).toBe(-80);
  });

  it("zero width/height should not cause error", () => {
    const { width, height } = getPerfectElementSize("ellipse", 0, 0);
    expect(width).toBe(0);
    expect(height).toBe(0);
  });

  it("NaN values should return NaN", () => {
    const { width, height } = getPerfectElementSize("rectangle", NaN, NaN);
    expect(Number.isNaN(width)).toBe(true);
    expect(Number.isNaN(height)).toBe(true);
  });

  it("Infinity should return Infinity", () => {
    const { width, height } = getPerfectElementSize("rectangle", Infinity, Infinity);
    expect(width).toBe(Infinity);
    expect(height).toBe(Infinity);
  });

  it("float values should be rounded", () => {
    const { width, height } = getPerfectElementSize("rectangle", 123.4567, 89.9876);
    expect(width).toBeCloseTo(123.457, EPSILON_DIGITS);
    expect(height).toBeCloseTo(89.988, EPSILON_DIGITS);
  });
});

// Tests for isInvisiblySmallElement

describe("isInvisiblySmallElement", () => {
  it("small elements but with 2 points are not invisible", () => {
    const element = {
      type: "line",
      width: 0.05,
      height: 0.05,
      points: [{ x: 0, y: 0 }, { x: 0.05, y: 0.05 }]
    } as any;
    expect(isInvisiblySmallElement(element)).toBe(false);
  });

  it("visible elements should return false", () => {
    const element = { width: 10, height: 10, type: "rectangle" } as any;
    expect(isInvisiblySmallElement(element)).toBe(false);
  });

  it("negative elements but with 2 points are not invisible", () => {
    const element = {
      width: -5,
      height: -5,
      type: "line",
      points: [{ x: 0, y: 0 }, { x: -5, y: -5 }]
    } as any;
    expect(isInvisiblySmallElement(element)).toBe(false);
  });
});