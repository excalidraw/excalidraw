import { restoreElements } from "../data/restore";

import { API } from "./helpers/api";

/** restore a single rectangle with the given raw overrides, keeping geometry */
const restoreGeometry = (overrides: Record<string, unknown>) => {
  const base = API.createElement({
    type: "rectangle",
    x: 1,
    y: 2,
    width: 10,
    height: 20,
  });

  const [restored] = restoreElements(
    [{ ...base, ...overrides }] as any,
    null,
  ) as any[];

  return {
    x: restored.x,
    y: restored.y,
    width: restored.width,
    height: restored.height,
  };
};

describe("restoreElements geometry sanitization", () => {
  it("keeps finite geometry as it is", () => {
    expect(restoreGeometry({ x: 1, y: 2, width: 10, height: 20 })).toEqual({
      x: 1,
      y: 2,
      width: 10,
      height: 20,
    });
  });

  it("keeps negative coordinates", () => {
    expect(restoreGeometry({ x: -100, y: -50 })).toMatchObject({
      x: -100,
      y: -50,
    });
  });

  it("replaces NaN coordinates with 0", () => {
    expect(restoreGeometry({ x: NaN, y: NaN })).toMatchObject({ x: 0, y: 0 });
  });

  it("replaces non-finite coordinates with 0", () => {
    expect(restoreGeometry({ x: Infinity, y: -Infinity })).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it("replaces non-finite dimensions with 0", () => {
    expect(restoreGeometry({ width: Infinity, height: NaN })).toMatchObject({
      width: 0,
      height: 0,
    });
  });

  it("replaces non-numeric geometry with 0", () => {
    expect(
      restoreGeometry({ x: "5", y: null, width: undefined, height: {} }),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("sanitizes each axis independently", () => {
    expect(restoreGeometry({ x: NaN, y: 42, width: 7, height: NaN })).toEqual({
      x: 0,
      y: 42,
      width: 7,
      height: 0,
    });
  });
});
