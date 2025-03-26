import { vi } from "vitest";

import * as constants from "@excalidraw/common";

import { getPerfectElementSize } from "../src/sizeHelpers";

const EPSILON_DIGITS = 3;
// Needed so that we can mock the value of constants which is done in
// below tests. In Jest this wasn't needed as global override was possible
// but vite doesn't allow that hence we need to mock
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

  it("should return height:0 if `elementType` is arrow and locked angle is 0", () => {
    const { height, width } = getPerfectElementSize("arrow", 200, 20);
    expect(width).toBeCloseTo(200, EPSILON_DIGITS);
    expect(height).toBeCloseTo(0, EPSILON_DIGITS);
  });
  it("should return width:0 if `elementType` is arrow and locked angle is 90 deg (Math.PI/2)", () => {
    const { height, width } = getPerfectElementSize("arrow", 10, 100);
    expect(width).toBeCloseTo(0, EPSILON_DIGITS);
    expect(height).toBeCloseTo(100, EPSILON_DIGITS);
  });

  it("should return adjust height to be width * tan(locked angle)", () => {
    const { height, width } = getPerfectElementSize("arrow", 120, 185);
    expect(width).toBeCloseTo(120, EPSILON_DIGITS);
    expect(height).toBeCloseTo(207.846, EPSILON_DIGITS);
  });

  it("should return height equals to width if locked angle is 45 deg", () => {
    const { height, width } = getPerfectElementSize("arrow", 135, 145);
    expect(width).toBeCloseTo(135, EPSILON_DIGITS);
    expect(height).toBeCloseTo(135, EPSILON_DIGITS);
  });

  it("should return height:0 and width:0 when width and height are 0", () => {
    const { height, width } = getPerfectElementSize("arrow", 0, 0);
    expect(width).toBeCloseTo(0, EPSILON_DIGITS);
    expect(height).toBeCloseTo(0, EPSILON_DIGITS);
  });

  describe("should respond to SHIFT_LOCKING_ANGLE constant", () => {
    it("should have only 2 locking angles per section if SHIFT_LOCKING_ANGLE = 45 deg (Math.PI/4)", () => {
      (constants as any).SHIFT_LOCKING_ANGLE = Math.PI / 4;
      const { height, width } = getPerfectElementSize("arrow", 120, 185);
      expect(width).toBeCloseTo(120, EPSILON_DIGITS);
      expect(height).toBeCloseTo(120, EPSILON_DIGITS);
    });
  });
});
