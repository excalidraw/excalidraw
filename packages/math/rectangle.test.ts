import { pointFrom } from "./point";
import { rectangle, rectangleDistanceFromPoint } from "./rectangle";

describe("rectangle distance", () => {
  it("finds the shortest distance", () => {
    expect(
      rectangleDistanceFromPoint(
        rectangle(pointFrom(-1, -1), pointFrom(1, 1)),
        pointFrom(2, 0),
      ),
    ).toBe(1);
    expect(
      rectangleDistanceFromPoint(
        rectangle(pointFrom(-1, -1), pointFrom(1, 1)),
        pointFrom(0, 2),
      ),
    ).toBe(1);
    expect(
      rectangleDistanceFromPoint(
        rectangle(pointFrom(-1, -1), pointFrom(1, 1)),
        pointFrom(-2, 0),
      ),
    ).toBe(1);
    expect(
      rectangleDistanceFromPoint(
        rectangle(pointFrom(-1, -1), pointFrom(1, 1)),
        pointFrom(0, -2),
      ),
    ).toBe(1);
  });
  it("finds the corner as closest point", () => {
    expect(
      rectangleDistanceFromPoint(
        rectangle(pointFrom(-1, -1), pointFrom(1, 1)),
        pointFrom(2, 2),
      ),
    ).toBe(Math.sqrt(2));
  });
});
