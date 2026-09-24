import { getSvgPathFromStroke } from "../src/shape";

describe("getSvgPathFromStroke", () => {
  it("Small values in exponential notation rounded correctly", () => {
    const outline = [
      [8.572527594031472e-17, -1.4],
      [1.4, 1.7145055188062944e-16],
      [-8.572527594031472e-17, 1.4],
    ];

    expect(getSvgPathFromStroke(outline)).toBe(
      "M 0,-1.4 Q 0,-1.4 0.7,-0.7 1.4,0 0.7,0.7 0,1.4 0,0 L 0,-1.4 Z",
    );
  });
});
