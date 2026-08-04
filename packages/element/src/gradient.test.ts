import { getGradientLineCoords } from "./gradient";

describe("getGradientLineCoords", () => {
  it("computes a left-to-right line at angle 0", () => {
    const { x1, y1, x2, y2 } = getGradientLineCoords(100, 50, 0);
    expect(x1).toBeCloseTo(0);
    expect(y1).toBeCloseTo(25);
    expect(x2).toBeCloseTo(100);
    expect(y2).toBeCloseTo(25);
  });

  it("computes a top-to-bottom line at angle 90", () => {
    const { x1, y1, x2, y2 } = getGradientLineCoords(100, 50, 90);
    expect(x1).toBeCloseTo(50);
    expect(y1).toBeCloseTo(0);
    expect(x2).toBeCloseTo(50);
    expect(y2).toBeCloseTo(50);
  });

  it("computes a right-to-left line at angle 180", () => {
    const { x1, y1, x2, y2 } = getGradientLineCoords(100, 50, 180);
    expect(x1).toBeCloseTo(100);
    expect(y1).toBeCloseTo(25);
    expect(x2).toBeCloseTo(0);
    expect(y2).toBeCloseTo(25);
  });

  it("computes a bottom-to-top line at angle 270", () => {
    const { x1, y1, x2, y2 } = getGradientLineCoords(100, 50, 270);
    expect(x1).toBeCloseTo(50);
    expect(y1).toBeCloseTo(50);
    expect(x2).toBeCloseTo(50);
    expect(y2).toBeCloseTo(0);
  });
});
