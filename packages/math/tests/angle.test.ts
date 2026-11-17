import {
  radiansBetweenAngles,
  degreesToRadians,
  radiansToDegrees,
  isRightAngleRads,
  radiansDifference,
} from "../src/angle";
import type { Degrees, Radians } from "../src/types";

describe("radiansBetweenAngles", () => {
  it("returns true when angle is within normal min < max range", () => {
    const min = (Math.PI / 4) as Radians;
    const max = (3 * Math.PI / 4) as Radians;
    const mid = (Math.PI / 2) as Radians;
    const outside = 0 as Radians;

    expect(radiansBetweenAngles(mid, min, max)).toBe(true);
    expect(radiansBetweenAngles(outside, min, max)).toBe(false);
  });

  it("returns true when range wraps around 0 (min > max)", () => {
    const min = (7 * Math.PI / 4) as Radians;
    const max = (Math.PI / 4) as Radians;
    const zero = 0 as Radians;
    const inside = (Math.PI / 8) as Radians;
    const outside = (Math.PI / 2) as Radians;

    expect(radiansBetweenAngles(zero, min, max)).toBe(true);
    expect(radiansBetweenAngles(inside, min, max)).toBe(true);
    expect(radiansBetweenAngles(outside, min, max)).toBe(false);
  });

  it("handles min === max point interval correctly", () => {
    const target = (Math.PI / 2) as Radians;
    const different = 0 as Radians;
    const opposite = Math.PI as Radians;

    expect(radiansBetweenAngles(target, target, target)).toBe(true);
    expect(radiansBetweenAngles(different, target, target)).toBe(false);
    expect(radiansBetweenAngles(opposite, target, target)).toBe(false);
  });
});

describe("angle conversions and helpers", () => {
  it("converts degrees to radians and back", () => {
    expect(degreesToRadians(180 as Degrees)).toBeCloseTo(Math.PI);
    expect(radiansToDegrees(Math.PI as Radians)).toBeCloseTo(180);
  });

  it("computes angle difference correctly across boundary", () => {
    const a = ((350 * Math.PI) / 180) as Radians;
    const b = ((10 * Math.PI) / 180) as Radians;
    expect(radiansDifference(a, b)).toBeCloseTo((20 * Math.PI) / 180);
  });

  it("identifies right angles correctly", () => {
    expect(isRightAngleRads((Math.PI / 2) as Radians)).toBe(true);
    expect(isRightAngleRads((Math.PI / 4) as Radians)).toBe(false);
  });
});
