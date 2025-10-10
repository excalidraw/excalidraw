import { line, linesIntersectAt } from "../src/line";
import { pointFrom } from "../src/point";

describe("line-line intersections", () => {
  it("should correctly detect intersection at origin", () => {
    expect(
      linesIntersectAt(
        line(pointFrom(-5, -5), pointFrom(5, 5)),
        line(pointFrom(5, -5), pointFrom(-5, 5)),
      ),
    ).toEqual(pointFrom(0, 0));
  });

  it("should correctly detect intersection at non-origin", () => {
    expect(
      linesIntersectAt(
        line(pointFrom(0, 0), pointFrom(10, 10)),
        line(pointFrom(10, 0), pointFrom(0, 10)),
      ),
    ).toEqual(pointFrom(5, 5));
  });

  it("should correctly detect parallel lines", () => {
    expect(
      linesIntersectAt(
        line(pointFrom(0, 0), pointFrom(0, 10)),
        line(pointFrom(10, 0), pointFrom(10, 10)),
      ),
    ).toBe(null);
  });
});
