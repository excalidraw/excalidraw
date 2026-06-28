import React from "react";
import { vi } from "vitest";

import { KEYS, MAX_ZOOM } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionResetZoom,
  actionZoomToFit,
  actionZoomToFitSelection,
} from "../actions/actionCanvas";
import { getNormalizedZoom } from "../scene";
import {
  animateToConstraints,
  constrainScrollState,
  getMinZoomForConstraints,
  isViewportOverscrolled,
  SCROLL_TO_CONTENT_ANIMATION_KEY,
} from "../scroll";
import { AnimationController } from "../renderer/animation";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

import type { AppState, ScrollConstraints } from "../types";

const { h } = window;

// `mockBoundingClientRect()` makes the viewport 200 x 100
const VIEWPORT = { width: 200, height: 100 };

const makeState = (
  overrides: Partial<AppState> & {
    scrollConstraints: ScrollConstraints | null;
  },
): Pick<
  AppState,
  "scrollX" | "scrollY" | "zoom" | "width" | "height" | "scrollConstraints"
> => ({
  scrollX: 0,
  scrollY: 0,
  zoom: { value: getNormalizedZoom(1) },
  width: VIEWPORT.width,
  height: VIEWPORT.height,
  ...overrides,
});

describe("constrainScrollState (pure)", () => {
  it("returns scroll/zoom unchanged when there are no constraints", () => {
    const state = makeState({
      scrollX: 123,
      scrollY: -45,
      zoom: { value: getNormalizedZoom(0.5) },
      scrollConstraints: null,
    });

    expect(constrainScrollState(state)).toEqual({
      scrollX: 123,
      scrollY: -45,
      zoom: { value: getNormalizedZoom(0.5) },
    });
  });

  describe("box larger than the viewport", () => {
    const box: ScrollConstraints = { x: 0, y: 0, width: 1000, height: 1000 };

    it("clamps scroll so the viewport can't leave the box", () => {
      // pan past the box's top-left corner → clamp to the corner (scroll 0)
      const corner = constrainScrollState(
        makeState({ scrollX: 100, scrollY: 100, scrollConstraints: box }),
      );
      expect(corner.scrollX).toBeCloseTo(0);
      expect(corner.scrollY).toBeCloseTo(0);

      // pan past the box's far edges → clamp to width/height - boxSize
      const farEdge = constrainScrollState(
        makeState({ scrollX: -5000, scrollY: -5000, scrollConstraints: box }),
      );
      expect(farEdge.scrollX).toBeCloseTo(VIEWPORT.width - box.width); // -800
      expect(farEdge.scrollY).toBeCloseTo(VIEWPORT.height - box.height); // -900
    });

    it("enforces a minimum zoom so the box keeps covering the viewport", () => {
      const minZoom = getMinZoomForConstraints(box, VIEWPORT);
      expect(minZoom).toBeCloseTo(0.2); // max(200/1000, 100/1000)

      const { zoom } = constrainScrollState(
        makeState({
          zoom: { value: getNormalizedZoom(0.1) },
          scrollConstraints: box,
        }),
      );
      expect(zoom.value).toBeCloseTo(minZoom);
    });

    it("leaves an in-bounds viewport untouched", () => {
      const inBounds = makeState({
        scrollX: -100,
        scrollY: -100,
        zoom: { value: getNormalizedZoom(1) },
        scrollConstraints: box,
      });
      expect(constrainScrollState(inBounds)).toMatchObject({
        scrollX: -100,
        scrollY: -100,
        zoom: { value: getNormalizedZoom(1) },
      });
    });
  });

  describe("box smaller than the viewport (best-effort fit)", () => {
    it("forces a zoom-in and removes pan room on the binding axis", () => {
      const box: ScrollConstraints = { x: 0, y: 0, width: 50, height: 50 };
      // minZoom = max(200/50, 100/50) = 4
      expect(getMinZoomForConstraints(box, VIEWPORT)).toBeCloseTo(4);

      const result = constrainScrollState(
        makeState({
          scrollX: 999,
          scrollY: 999,
          zoom: { value: getNormalizedZoom(1) },
          scrollConstraints: box,
        }),
      );

      expect(result.zoom.value).toBeCloseTo(4);
      // width binds: visible width (200/4=50) == box width → no x pan room
      expect(result.scrollX).toBeCloseTo(0);
      // height has slack (100/4=25 < 50) → clamped to the top edge here
      expect(result.scrollY).toBeCloseTo(0);
    });

    it("centers the box when it can't cover the viewport even at MAX_ZOOM", () => {
      const box: ScrollConstraints = { x: 0, y: 0, width: 1, height: 1 };
      expect(getMinZoomForConstraints(box, VIEWPORT)).toBe(MAX_ZOOM);

      const result = constrainScrollState(
        makeState({ scrollX: 1000, scrollY: 1000, scrollConstraints: box }),
      );

      expect(result.zoom.value).toBe(MAX_ZOOM);
      // centered: (min + max) / 2, with min = w/zoom - (x+w), max = -x
      const centeredX = (VIEWPORT.width / MAX_ZOOM - 1 + 0) / 2;
      expect(result.scrollX).toBeCloseTo(centeredX);
    });
  });
});

describe("scrollToContent scrollConstraints (integration)", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    AnimationController.reset();
  });

  it("snaps the current viewport inside the box when constraints are set", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // start well outside the future box
    React.act(() => {
      h.app.scrollToContent([], {
        scrollConstraints: { x: 0, y: 0, width: 1000, height: 1000 },
      });
    });

    // viewport must now be within [-800, 0] x [-900, 0]
    expect(h.state.scrollX).toBeLessThanOrEqual(0);
    expect(h.state.scrollX).toBeGreaterThanOrEqual(-800);
    expect(h.state.scrollY).toBeLessThanOrEqual(0);
    expect(h.state.scrollY).toBeGreaterThanOrEqual(-900);
    expect(h.state.zoom.value).toBeGreaterThanOrEqual(0.2);
  });

  it("prevents keyboard panning out of the box and restores freedom on clear", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.scrollToContent([], {
        scrollConstraints: { x: 0, y: 0, width: 300, height: 200 },
      });
    });

    // hammer page-down (pans down) far past the box; scroll must stay clamped
    for (let i = 0; i < 20; i++) {
      Keyboard.keyPress(KEYS.PAGE_DOWN);
    }
    expect(h.state.scrollY).toBeGreaterThanOrEqual(h.state.height - 200);

    // clearing constraints lets it scroll freely again
    React.act(() => {
      h.app.scrollToContent([], { scrollConstraints: null });
    });
    const before = h.state.scrollY;
    Keyboard.keyPress(KEYS.PAGE_DOWN);
    expect(h.state.scrollY).toBeLessThan(before);
  });

  it("clamps into the box once the scroll has settled on the content", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // an element well outside the future constraint box
    const rect = API.createElement({
      type: "rectangle",
      x: 2000,
      y: 2000,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);

    React.act(() => {
      h.app.scrollToContent(rect, {
        scrollConstraints: { x: 0, y: 0, width: 1000, height: 1000 },
        animate: false,
      });
    });

    // recentering on the element settles way past the box; the constraints are
    // applied on completion and clamp it back to the far edges (scrollX -800,
    // scrollY -900 at zoom 1)
    expect(h.state.scrollX).toBeCloseTo(-800);
    expect(h.state.scrollY).toBeCloseTo(-900);
  });

  it("defers applying the constraints until an animated scroll settles", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const rect = API.createElement({
      type: "rectangle",
      x: 2000,
      y: 2000,
      width: 100,
      height: 100,
    });
    API.setElements([rect]);

    React.act(() => {
      h.app.scrollToContent(rect, {
        scrollConstraints: { x: 0, y: 0, width: 1000, height: 1000 },
        animate: true,
        duration: 300,
      });
    });

    // the animation is in flight and the constraints have NOT been applied yet
    // — they're chained to run once it settles
    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      true,
    );
    expect(h.state.scrollConstraints).toBe(null);
  });

  it("disables reset-zoom and zoom-to-fit actions while constrained", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(true);

    React.act(() => {
      h.app.scrollToContent([], {
        scrollConstraints: { x: 0, y: 0, width: 500, height: 500 },
      });
    });

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(false);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(false);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFitSelection)).toBe(
      false,
    );
  });
});

describe("explicit minZoom / maxZoom (pure)", () => {
  const box: ScrollConstraints = { x: 0, y: 0, width: 1000, height: 1000 };

  it("lets minZoom override the box-enforced fit zoom (zoom out past the box)", () => {
    // without minZoom the box forces a fit zoom of 0.2; minZoom 0.1 takes over
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(0.1) },
        scrollConstraints: { ...box, minZoom: 0.1 },
      }),
    );
    expect(zoom.value).toBeCloseTo(0.1);
  });

  it("still clamps zoom out at minZoom", () => {
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(0.1) },
        scrollConstraints: { ...box, minZoom: 0.5 },
      }),
    );
    expect(zoom.value).toBeCloseTo(0.5);
  });

  it("lets maxZoom cap zoom-in below the global MAX_ZOOM", () => {
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(MAX_ZOOM) },
        scrollConstraints: { ...box, maxZoom: 3 },
      }),
    );
    expect(zoom.value).toBeCloseTo(3);
  });

  it("leaves an in-range zoom untouched", () => {
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(1.5) },
        scrollConstraints: { ...box, minZoom: 0.5, maxZoom: 3 },
      }),
    );
    expect(zoom.value).toBeCloseTo(1.5);
  });
});

describe("padding (pure)", () => {
  const box: ScrollConstraints = { x: 0, y: 0, width: 1000, height: 1000 };

  it("extends the scrollable area past each edge by `[top, right, bottom, left]`", () => {
    const padding: [number, number, number, number] = [10, 20, 30, 40];

    // pan past the top-left corner → clamp to the padded corner
    const topLeft = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollY: 999,
        scrollConstraints: { ...box, padding },
      }),
    );
    expect(topLeft.scrollX).toBeCloseTo(40); // left padding
    expect(topLeft.scrollY).toBeCloseTo(10); // top padding

    // pan past the far edges → clamp to width/height - boxSize - far padding
    const farEdge = constrainScrollState(
      makeState({
        scrollX: -5000,
        scrollY: -5000,
        scrollConstraints: { ...box, padding },
      }),
    );
    expect(farEdge.scrollX).toBeCloseTo(VIEWPORT.width - box.width - 20); // -820 (right)
    expect(farEdge.scrollY).toBeCloseTo(VIEWPORT.height - box.height - 30); // -930 (bottom)
  });

  it("keeps the padding a fixed screen distance regardless of zoom", () => {
    // 40 screen px of top padding at zoom 2 → 20 scene px
    const result = constrainScrollState(
      makeState({
        scrollY: 999,
        zoom: { value: getNormalizedZoom(2) },
        scrollConstraints: { ...box, padding: [40, 0, 0, 0] },
      }),
    );
    expect(result.scrollY).toBeCloseTo(20);
  });

  it("defaults to no extra room", () => {
    const result = constrainScrollState(
      makeState({ scrollX: 999, scrollConstraints: box }),
    );
    expect(result.scrollX).toBeCloseTo(0);
  });

  it("stacks with the rubberband tolerance", () => {
    const tolerance = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: { ...box, tolerance, padding: [0, 0, 0, 40] },
      }),
      tolerance,
    );
    // left padding (40) + tolerance overscroll (30) at zoom 1
    expect(result.scrollX).toBeCloseTo(70);
  });
});

describe("rubberband tolerance (pure)", () => {
  const box: ScrollConstraints = { x: 0, y: 0, width: 1000, height: 1000 };

  it("allows scroll overscroll up to `tolerance` screen pixels", () => {
    const tolerance = 30; // screen px
    // hard max for scrollX is -box.x = 0; soft adds tolerance / zoom scene px
    const result = constrainScrollState(
      makeState({ scrollX: 999, scrollConstraints: { ...box, tolerance } }),
      tolerance,
    );
    expect(result.scrollX).toBeCloseTo(tolerance / 1); // 30 (zoom 1)
  });

  it("keeps the overscroll a fixed screen distance regardless of zoom", () => {
    const tolerance = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        zoom: { value: getNormalizedZoom(2) },
        scrollConstraints: { ...box, tolerance },
      }),
      tolerance,
    );
    // 30 screen px at zoom 2 -> 15 scene px of overscroll
    expect(result.scrollX).toBeCloseTo(tolerance / 2); // 15
  });

  it("relaxes the minimum zoom by the `tolerance` screen pixels", () => {
    const tolerance = 25; // screen px
    // relaxed min zoom lets the box shrink within the viewport by `tolerance`
    // px on each side: max((200-50)/1000, (100-50)/1000) = 0.15
    const expected = getMinZoomForConstraints(box, {
      width: VIEWPORT.width - 2 * tolerance,
      height: VIEWPORT.height - 2 * tolerance,
    });
    const result = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(0.01) },
        scrollConstraints: { ...box, tolerance },
      }),
      tolerance,
    );
    expect(result.zoom.value).toBeCloseTo(expected); // 0.15
  });

  it("hard-clamps when tolerance is 0 (default)", () => {
    const result = constrainScrollState(
      makeState({ scrollX: 999, scrollConstraints: box }),
    );
    expect(result.scrollX).toBeCloseTo(0);
  });
});

describe("isViewportOverscrolled (pure)", () => {
  const box: ScrollConstraints = { x: 0, y: 0, width: 1000, height: 1000 };

  it("is false when there are no constraints", () => {
    expect(
      isViewportOverscrolled(
        makeState({ scrollX: 9999, scrollConstraints: null }),
      ),
    ).toBe(false);
  });

  it("is false when the viewport is within the hard bounds", () => {
    expect(
      isViewportOverscrolled(
        makeState({ scrollX: -100, scrollY: -100, scrollConstraints: box }),
      ),
    ).toBe(false);
  });

  it("is true when panned past an edge (rubberband overscroll)", () => {
    // scrollX 30 is past the hard max of 0
    expect(
      isViewportOverscrolled(
        makeState({ scrollX: 30, scrollConstraints: box }),
      ),
    ).toBe(true);
  });

  it("is true when zoomed out below the fit zoom", () => {
    // fit zoom for this box is 0.2; 0.1 is below it
    expect(
      isViewportOverscrolled(
        makeState({
          zoom: { value: getNormalizedZoom(0.1) },
          scrollConstraints: box,
        }),
      ),
    ).toBe(true);
  });
});

describe("animateToConstraints (rubberband snap-back)", () => {
  afterEach(() => {
    AnimationController.reset();
  });

  const box: ScrollConstraints = { x: 0, y: 0, width: 1000, height: 1000 };

  it("starts an animation toward the box when overscrolled", () => {
    const onFrame = vi.fn();
    // scrollX 200 is outside the hard range [-800, 0]
    animateToConstraints(
      makeState({ scrollX: 200, scrollConstraints: box }),
      onFrame,
    );
    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      true,
    );
    expect(onFrame).toHaveBeenCalled();
  });

  it("is a no-op when already within the box", () => {
    const onFrame = vi.fn();
    animateToConstraints(
      makeState({ scrollX: -100, scrollConstraints: box }),
      onFrame,
    );
    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      false,
    );
    expect(onFrame).not.toHaveBeenCalled();
  });
});

describe("rubberband tolerance (integration)", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    AnimationController.reset();
  });

  it("lets the user pan past the box edge (bounded by tolerance)", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.scrollToContent([], {
        scrollConstraints: {
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          tolerance: 25,
        },
      });
    });

    // snapped to the top edge (hard max scrollY = 0)
    expect(h.state.scrollY).toBe(0);

    // page-up pans up, pushing scrollY past the hard edge into the overscroll
    Keyboard.keyPress(KEYS.PAGE_UP);

    // overscrolled past 0, but bounded by tolerance (25 screen px / zoom 1)
    expect(h.state.scrollY).toBeGreaterThan(0);
    expect(h.state.scrollY).toBeLessThanOrEqual(
      25 / h.state.zoom.value + 0.001,
    );
  });
});
