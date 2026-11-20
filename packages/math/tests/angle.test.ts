import {
  cartesian2Polar,
  degreesToRadians,
  isRightAngleRads,
  normalizeRadians,
  radiansBetweenAngles,
  radiansDifference,
  radiansToDegrees,
} from "../src/angle";
import { pointFrom } from "../src/point";

import type { Degrees, Radians } from "../src/types";

const HALF_PI = (Math.PI / 2) as Radians;
const PI = Math.PI as Radians;
const TWO_PI = (Math.PI * 2) as Radians;

describe("normalizeRadians", () => {
  it("should leave angles within [0, 2π) untouched", () => {
    expect(normalizeRadians(0 as Radians)).toBe(0);
    expect(normalizeRadians(HALF_PI)).toBeCloseTo(Math.PI / 2);
    expect(normalizeRadians(PI)).toBeCloseTo(Math.PI);
  });

  it("should wrap angles at and above 2π back into range", () => {
    expect(normalizeRadians(TWO_PI)).toBe(0);
    expect(normalizeRadians((TWO_PI + Math.PI / 2) as Radians)).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("should map negative angles into the positive range", () => {
    expect(normalizeRadians(-HALF_PI as Radians)).toBeCloseTo(
      (3 * Math.PI) / 2,
    );
    expect(normalizeRadians(-PI as Radians)).toBeCloseTo(Math.PI);
  });
});

describe("degreesToRadians / radiansToDegrees", () => {
  it("should convert the cardinal angles", () => {
    expect(degreesToRadians(0 as Degrees)).toBe(0);
    expect(degreesToRadians(90 as Degrees)).toBeCloseTo(Math.PI / 2);
    expect(degreesToRadians(180 as Degrees)).toBeCloseTo(Math.PI);

    expect(radiansToDegrees(0 as Radians)).toBe(0);
    expect(radiansToDegrees(HALF_PI)).toBeCloseTo(90);
    expect(radiansToDegrees(PI)).toBeCloseTo(180);
  });

  it("should round-trip a value through both conversions", () => {
    expect(radiansToDegrees(degreesToRadians(37 as Degrees))).toBeCloseTo(37);
  });
});

describe("cartesian2Polar", () => {
  it("should return the radius as the distance from the origin", () => {
    const [radius] = cartesian2Polar(pointFrom(3, 4));
    expect(radius).toBeCloseTo(5);
  });

  it("should return the angle measured from the positive x axis", () => {
    const [, angle] = cartesian2Polar(pointFrom(1, 0));
    expect(angle).toBeCloseTo(0);

    const [, quarterTurn] = cartesian2Polar(pointFrom(0, 1));
    expect(quarterTurn).toBeCloseTo(Math.PI / 2);
  });

  it("should normalize the angle for points below the x axis", () => {
    const [, angle] = cartesian2Polar(pointFrom(0, -1));
    expect(angle).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe("isRightAngleRads", () => {
  // Despite the name, this reports whether the angle is axis-aligned, i.e. any
  // multiple of π/2 — which is the condition its only caller (renderElement,
  // deciding whether image smoothing can be disabled) actually needs.
  it("should accept every multiple of π/2", () => {
    expect(isRightAngleRads(0 as Radians)).toBe(true);
    expect(isRightAngleRads(HALF_PI)).toBe(true);
    expect(isRightAngleRads(PI)).toBe(true);
    expect(isRightAngleRads(((3 * Math.PI) / 2) as Radians)).toBe(true);
    expect(isRightAngleRads(TWO_PI)).toBe(true);
  });

  it("should reject angles off the axes", () => {
    expect(isRightAngleRads(degreesToRadians(45 as Degrees))).toBe(false);
    expect(isRightAngleRads(degreesToRadians(30 as Degrees))).toBe(false);
    expect(isRightAngleRads(degreesToRadians(135 as Degrees))).toBe(false);
  });

  it("should tolerate floating point drift around the axes", () => {
    expect(isRightAngleRads((Math.PI / 2 + 1e-9) as Radians)).toBe(true);
  });
});

describe("radiansBetweenAngles", () => {
  it("should detect angles inside a non-wrapping range", () => {
    expect(radiansBetweenAngles(HALF_PI, 0 as Radians, PI)).toBe(true);
    expect(
      radiansBetweenAngles(((3 * Math.PI) / 2) as Radians, 0 as Radians, PI),
    ).toBe(false);
  });

  it("should include the range boundaries", () => {
    expect(radiansBetweenAngles(0 as Radians, 0 as Radians, PI)).toBe(true);
    expect(radiansBetweenAngles(PI, 0 as Radians, PI)).toBe(true);
  });

  it("should handle a range wrapping across the 0 angle", () => {
    // range from 270° to 90°, passing through 0
    const min = ((3 * Math.PI) / 2) as Radians;
    const max = HALF_PI;

    expect(radiansBetweenAngles(0 as Radians, min, max)).toBe(true);
    expect(radiansBetweenAngles(((7 * Math.PI) / 4) as Radians, min, max)).toBe(
      true,
    );
    expect(radiansBetweenAngles(PI, min, max)).toBe(false);
  });
});

describe("radiansDifference", () => {
  it("should return the absolute difference for close angles", () => {
    expect(radiansDifference(HALF_PI, 0 as Radians)).toBeCloseTo(Math.PI / 2);
    expect(radiansDifference(0 as Radians, HALF_PI)).toBeCloseTo(Math.PI / 2);
  });

  it("should return zero for identical angles", () => {
    expect(radiansDifference(HALF_PI, HALF_PI)).toBe(0);
  });

  it("should take the shorter way around rather than the long arc", () => {
    // 350° and 10° are 20° apart, not 340°
    const a = degreesToRadians(350 as Degrees);
    const b = degreesToRadians(10 as Degrees);

    expect(radiansDifference(a, b)).toBeCloseTo(degreesToRadians(20 as Degrees));
    expect(radiansDifference(b, a)).toBeCloseTo(degreesToRadians(20 as Degrees));
  });

  it("should never exceed π", () => {
    expect(
      radiansDifference(0 as Radians, ((3 * Math.PI) / 2) as Radians),
    ).toBeLessThanOrEqual(Math.PI + Number.EPSILON);
  });
});
