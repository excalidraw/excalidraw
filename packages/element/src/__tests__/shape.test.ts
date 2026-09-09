import { newElement } from "../newElement";
import { ShapeCache } from "../shape";

import type { ExcalidrawRectangleElement } from "../types";

describe("ShapeCache.copy", () => {
  afterEach(() => {
    ShapeCache.destroy();
  });

  it("carries a cached shape over to a different element instance", () => {
    const from = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }) as ExcalidrawRectangleElement;
    const to = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });

    const shape = ShapeCache.generateElementShape(from, null);

    expect(ShapeCache.get(to, null)).toBeUndefined();

    ShapeCache.copy(from, to);

    expect(ShapeCache.get(to, null)).toBe(shape);
  });

  it("is a no-op when the source has no cached shape", () => {
    const from = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    const to = newElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });

    ShapeCache.copy(from, to);

    expect(ShapeCache.get(to, null)).toBeUndefined();
  });
});
