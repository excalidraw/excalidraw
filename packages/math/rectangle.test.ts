import { point } from "./point";
import { rectangle, rectangleDistanceFromPoint } from "./rectangle";

describe("rectangle distance", () => {
  it("finds the shortest distance", () => {
    expect(
      rectangleDistanceFromPoint(
        rectangle(point(-1, -1), point(1, 1)),
        point(2, 0),
      ),
    ).toBe(1);
    expect(
      rectangleDistanceFromPoint(
        rectangle(point(-1, -1), point(1, 1)),
        point(0, 2),
      ),
    ).toBe(1);
    expect(
      rectangleDistanceFromPoint(
        rectangle(point(-1, -1), point(1, 1)),
        point(-2, 0),
      ),
    ).toBe(1);
    expect(
      rectangleDistanceFromPoint(
        rectangle(point(-1, -1), point(1, 1)),
        point(0, -2),
      ),
    ).toBe(1);
  });
  it("finds the corner as closest point", () => {
    expect(
      rectangleDistanceFromPoint(
        rectangle(point(-1, -1), point(1, 1)),
        point(2, 2),
      ),
    ).toBe(Math.sqrt(2));
  });
});
