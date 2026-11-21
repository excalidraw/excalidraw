import { scrollBoundsIntoView } from "../viewport";

import type { NormalizedZoomValue } from "../types";

const appState = (zoom = 1) => ({
  scrollX: 0,
  scrollY: 0,
  zoom: { value: zoom as NormalizedZoomValue },
  width: 1000,
  height: 800,
});

describe("scrollBoundsIntoView", () => {
  it("should leave bounds that are in view already", () => {
    expect(
      scrollBoundsIntoView({
        bounds: [100, 100, 200, 200],
        appState: appState(),
      }),
    ).toBe(null);
  });

  it("should bring bounds past an edge in by the least movement", () => {
    // 50px past the right edge, 30px above the top
    expect(
      scrollBoundsIntoView({
        bounds: [900, -30, 1050, 100],
        appState: appState(),
      }),
    ).toEqual({ scrollX: -50, scrollY: 30 });
  });

  it("should keep the offsets clear", () => {
    // a 320px sidebar on the right
    expect(
      scrollBoundsIntoView({
        bounds: [900, 100, 1000, 200],
        appState: appState(),
        offsets: { right: 320 },
      }),
    ).toEqual({ scrollX: -320, scrollY: 0 });
  });

  it("should measure in screen px at any zoom", () => {
    // at 200%, [450, 550] is at [900, 1100] on screen: 100px past the edge,
    // i.e. 50 scene units
    expect(
      scrollBoundsIntoView({
        bounds: [450, 100, 550, 150],
        appState: appState(2),
      }),
    ).toEqual({ scrollX: -50, scrollY: 0 });
  });

  it("should bring in the start of bounds that don't fit, or leave that axis", () => {
    // taller than the view
    const bounds = [100, 500, 200, 2000] as const;
    expect(scrollBoundsIntoView({ bounds, appState: appState() })).toEqual({
      scrollX: 0,
      scrollY: -500,
    });
    expect(
      scrollBoundsIntoView({ bounds, appState: appState(), tooLarge: "leave" }),
    ).toBe(null);
  });

  it("should do nothing when the offsets leave no room", () => {
    expect(
      scrollBoundsIntoView({
        bounds: [900, 0, 1100, 10],
        appState: appState(),
        offsets: { left: 600, right: 600 },
      }),
    ).toBe(null);
  });
});
