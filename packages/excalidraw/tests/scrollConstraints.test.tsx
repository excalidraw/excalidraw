import React from "react";
import { vi } from "vitest";

import { KEYS, MAX_ZOOM } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionResetZoom,
  actionZoomIn,
  actionZoomOut,
  actionZoomToFit,
  actionZoomToFitSelection,
} from "../actions/actionCanvas";
import { getNormalizedZoom } from "../scene";
import {
  animateToConstraints,
  constrainScrollState,
  isViewportOverscrolled,
  SCROLL_TO_CONTENT_ANIMATION_KEY,
} from "../viewport";
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

/** A lock box with sensible defaults; pass `lockScroll`/`lockZoom`/`zoom`/
 * `tolerance`/`offset` to override. */
const makeLock = (
  overrides: Partial<ScrollConstraints> &
    Pick<ScrollConstraints, "x" | "y" | "width" | "height">,
): ScrollConstraints => ({
  lockScroll: false,
  lockZoom: false,
  zoom: 1,
  tolerance: 0,
  ...overrides,
});

describe("constrainScrollState (pure)", () => {
  it("returns scroll/zoom unchanged when there is no lock", () => {
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

  it("leaves scroll free when only zoom is locked", () => {
    const lock = makeLock({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      lockZoom: true,
      zoom: 0.2,
    });
    const result = constrainScrollState(
      makeState({ scrollX: 9999, scrollY: 9999, scrollConstraints: lock }),
    );
    expect(result.scrollX).toBe(9999);
    expect(result.scrollY).toBe(9999);
  });

  it("leaves zoom free when only scroll is locked", () => {
    const lock = makeLock({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      lockScroll: true,
    });
    // a zoom that would have been forced up by the old box-cover fit zoom
    // (0.2 for this box) stays as-is when only scroll is locked
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(0.15) },
        scrollConstraints: lock,
      }),
    );
    expect(zoom.value).toBeCloseTo(0.15);
  });

  describe("scroll lock", () => {
    const lock = makeLock({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      lockScroll: true,
    });

    it("clamps scroll so the viewport can't leave the box", () => {
      // pan past the box's top-left corner → clamp to the corner (scroll 0)
      const corner = constrainScrollState(
        makeState({ scrollX: 100, scrollY: 100, scrollConstraints: lock }),
      );
      expect(corner.scrollX).toBeCloseTo(0);
      expect(corner.scrollY).toBeCloseTo(0);

      // pan past the box's far edges → clamp to width/height - boxSize
      const farEdge = constrainScrollState(
        makeState({ scrollX: -5000, scrollY: -5000, scrollConstraints: lock }),
      );
      expect(farEdge.scrollX).toBeCloseTo(VIEWPORT.width - lock.width); // -800
      expect(farEdge.scrollY).toBeCloseTo(VIEWPORT.height - lock.height); // -900
    });

    it("leaves an in-bounds viewport untouched", () => {
      const inBounds = makeState({
        scrollX: -100,
        scrollY: -100,
        zoom: { value: getNormalizedZoom(1) },
        scrollConstraints: lock,
      });
      expect(constrainScrollState(inBounds)).toMatchObject({
        scrollX: -100,
        scrollY: -100,
        zoom: { value: getNormalizedZoom(1) },
      });
    });

    it("centers the box when the viewport is larger than it", () => {
      // at zoom 0.1 the visible width (200/0.1 = 2000) exceeds the box (1000),
      // so there's no pan room → the box is centered on the axis
      const result = constrainScrollState(
        makeState({
          scrollX: 999,
          zoom: { value: getNormalizedZoom(0.1) },
          scrollConstraints: lock,
        }),
      );
      // centered: (min + max) / 2, min = w/zoom - (x+w), max = -x
      const centeredX = (VIEWPORT.width / 0.1 - lock.width + 0) / 2;
      expect(result.scrollX).toBeCloseTo(centeredX);
    });
  });
});

describe("zoom lock (pure)", () => {
  const base = { x: 0, y: 0, width: 1000, height: 1000 } as const;

  it("floors zoom-out at the locked zoom", () => {
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(0.1) },
        scrollConstraints: makeLock({ ...base, lockZoom: true, zoom: 0.5 }),
      }),
    );
    expect(zoom.value).toBeCloseTo(0.5);
  });

  it("always allows zooming in up to MAX_ZOOM", () => {
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(MAX_ZOOM) },
        scrollConstraints: makeLock({ ...base, lockZoom: true, zoom: 0.5 }),
      }),
    );
    expect(zoom.value).toBeCloseTo(MAX_ZOOM);
  });

  it("leaves an in-range zoom untouched", () => {
    const { zoom } = constrainScrollState(
      makeState({
        zoom: { value: getNormalizedZoom(1.5) },
        scrollConstraints: makeLock({ ...base, lockZoom: true, zoom: 0.5 }),
      }),
    );
    expect(zoom.value).toBeCloseTo(1.5);
  });
});

describe("offset (pure)", () => {
  const base = { x: 0, y: 0, width: 1000, height: 1000 } as const;

  it("extends the scrollable area past each edge", () => {
    const offset = { top: 10, right: 20, bottom: 30, left: 40 };
    const lock = makeLock({ ...base, lockScroll: true, offset });

    // pan past the top-left corner → clamp to the offset corner
    const topLeft = constrainScrollState(
      makeState({ scrollX: 999, scrollY: 999, scrollConstraints: lock }),
    );
    expect(topLeft.scrollX).toBeCloseTo(40); // left offset
    expect(topLeft.scrollY).toBeCloseTo(10); // top offset

    // pan past the far edges → clamp to width/height - boxSize - far offset
    const farEdge = constrainScrollState(
      makeState({ scrollX: -5000, scrollY: -5000, scrollConstraints: lock }),
    );
    expect(farEdge.scrollX).toBeCloseTo(VIEWPORT.width - base.width - 20); // -820
    expect(farEdge.scrollY).toBeCloseTo(VIEWPORT.height - base.height - 30); // -930
  });

  it("keeps the offset a fixed screen distance regardless of zoom", () => {
    // 40 screen px of top offset at zoom 2 → 20 scene px
    const result = constrainScrollState(
      makeState({
        scrollY: 999,
        zoom: { value: getNormalizedZoom(2) },
        scrollConstraints: makeLock({
          ...base,
          lockScroll: true,
          offset: { top: 40 },
        }),
      }),
    );
    expect(result.scrollY).toBeCloseTo(20);
  });

  it("defaults to no extra room", () => {
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({ ...base, lockScroll: true }),
      }),
    );
    expect(result.scrollX).toBeCloseTo(0);
  });

  it("stacks with the rubberband tolerance", () => {
    const tolerance = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({
          ...base,
          lockScroll: true,
          tolerance,
          offset: { left: 40 },
        }),
      }),
      tolerance,
    );
    // left offset (40) + tolerance overscroll (30) at zoom 1
    expect(result.scrollX).toBeCloseTo(70);
  });
});

describe("rubberband tolerance (pure)", () => {
  const base = { x: 0, y: 0, width: 1000, height: 1000 } as const;

  it("allows scroll overscroll up to `tolerance` screen pixels", () => {
    const tolerance = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({ ...base, lockScroll: true, tolerance }),
      }),
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
        scrollConstraints: makeLock({ ...base, lockScroll: true, tolerance }),
      }),
      tolerance,
    );
    // 30 screen px at zoom 2 -> 15 scene px of overscroll
    expect(result.scrollX).toBeCloseTo(tolerance / 2); // 15
  });

  it("hard-clamps when tolerance is 0 (default)", () => {
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({ ...base, lockScroll: true }),
      }),
    );
    expect(result.scrollX).toBeCloseTo(0);
  });
});

describe("isViewportOverscrolled (pure)", () => {
  const base = { x: 0, y: 0, width: 1000, height: 1000 } as const;

  it("is false when there is no lock", () => {
    expect(
      isViewportOverscrolled(
        makeState({ scrollX: 9999, scrollConstraints: null }),
      ),
    ).toBe(false);
  });

  it("is false when the viewport is within the hard bounds", () => {
    expect(
      isViewportOverscrolled(
        makeState({
          scrollX: -100,
          scrollY: -100,
          scrollConstraints: makeLock({ ...base, lockScroll: true }),
        }),
      ),
    ).toBe(false);
  });

  it("is true when panned past an edge (scroll lock)", () => {
    // scrollX 30 is past the hard max of 0
    expect(
      isViewportOverscrolled(
        makeState({
          scrollX: 30,
          scrollConstraints: makeLock({ ...base, lockScroll: true }),
        }),
      ),
    ).toBe(true);
  });

  it("is true when zoomed out below the locked zoom (zoom lock)", () => {
    expect(
      isViewportOverscrolled(
        makeState({
          zoom: { value: getNormalizedZoom(0.1) },
          scrollConstraints: makeLock({ ...base, lockZoom: true, zoom: 0.2 }),
        }),
      ),
    ).toBe(true);
  });
});

describe("animateToConstraints (rubberband snap-back)", () => {
  afterEach(() => {
    AnimationController.reset();
  });

  const lock = makeLock({
    x: 0,
    y: 0,
    width: 1000,
    height: 1000,
    lockScroll: true,
  });

  it("starts an animation toward the box when overscrolled", () => {
    const onFrame = vi.fn();
    // scrollX 200 is outside the hard range [-800, 0]
    animateToConstraints(
      makeState({ scrollX: 200, scrollConstraints: lock }),
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
      makeState({ scrollX: -100, scrollConstraints: lock }),
      onFrame,
    );
    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      false,
    );
    expect(onFrame).not.toHaveBeenCalled();
  });
});

describe("scrollTo lock (integration)", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    AnimationController.reset();
  });

  it("installs a scroll lock and prevents keyboard panning out of the box", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.scrollTo({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true },
      });
    });

    expect(h.state.scrollConstraints).not.toBe(null);

    // hammer page-down (pans down) far past the box; scroll must stay clamped
    for (let i = 0; i < 20; i++) {
      Keyboard.keyPress(KEYS.PAGE_DOWN);
    }
    expect(h.state.scrollY).toBeGreaterThanOrEqual(h.state.height - 1000);

    // clearing the lock lets it scroll freely again
    React.act(() => {
      h.app.scrollTo(null);
    });
    expect(h.state.scrollConstraints).toBe(null);
    const before = h.state.scrollY;
    Keyboard.keyPress(KEYS.PAGE_DOWN);
    expect(h.state.scrollY).toBeLessThan(before);
  });

  it("defers installing the lock until an animated scroll settles", async () => {
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
      h.app.scrollTo({
        target: rect,
        fit: "scale-down",
        animation: { duration: 300 },
        lock: { scroll: true },
      });
    });

    // the animation is in flight and the lock has NOT been installed yet —
    // it's chained to run once the scroll settles
    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      true,
    );
    expect(h.state.scrollConstraints).toBe(null);
  });

  it("supports rect targets and defaults missing dimensions to the viewport", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.scrollTo({
        target: { x: 10, y: 20, width: 50 },
        fit: "scale-down",
        animation: false,
        lock: { scroll: true },
      });
    });

    expect(h.state.scrollConstraints).toMatchObject({
      x: 10,
      y: 20,
      width: 50,
      height: h.state.height,
    });

    React.act(() => {
      h.app.scrollTo({
        target: { x: 30, y: 40, height: 60 },
        fit: "scale-down",
        animation: false,
        lock: { scroll: true },
      });
    });

    expect(h.state.scrollConstraints).toMatchObject({
      x: 30,
      y: 40,
      width: h.state.width,
      height: 60,
    });

    React.act(() => {
      h.app.scrollTo({
        target: { x: 70, y: 80 },
        fit: "scale-down",
        animation: false,
        lock: { scroll: true },
      });
    });

    expect(h.state.scrollConstraints).toMatchObject({
      x: 70,
      y: 80,
      width: h.state.width,
      height: h.state.height,
    });
  });

  it("filters deleted, non-scene, and nullable element targets", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const warnMessage =
      "supplied element(s) to scroll to contain deleted or non-existent elements which have been filtered out";

    try {
      const validRect = API.createElement({
        type: "rectangle",
        x: 100,
        y: 200,
        width: 300,
        height: 400,
      });
      const deletedRect = API.createElement({
        type: "rectangle",
        isDeleted: true,
      });
      const missingRect = API.createElement({
        type: "rectangle",
      });
      API.setElements([validRect, deletedRect]);

      React.act(() => {
        h.app.scrollTo({
          target: [
            validRect,
            deletedRect,
            missingRect,
            undefined,
            null,
          ] as unknown as readonly typeof validRect[],
          fit: "scale-down",
          animation: false,
          lock: { scroll: true },
        });
      });

      expect(warnSpy).toHaveBeenCalledWith(warnMessage);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(h.state.scrollConstraints).toMatchObject({
        x: validRect.x,
        y: validRect.y,
        width: validRect.width,
        height: validRect.height,
      });

      const scrollConstraints = h.state.scrollConstraints;
      warnSpy.mockClear();

      React.act(() => {
        h.app.scrollTo({
          target: [
            deletedRect,
            missingRect,
            undefined,
            null,
          ] as unknown as readonly typeof validRect[],
          fit: "scale-down",
          animation: false,
          lock: { scroll: true },
        });
      });

      expect(warnSpy).toHaveBeenCalledWith(warnMessage);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(h.state.scrollConstraints).toBe(scrollConstraints);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("disables zoom-to-fit actions while locked, but keeps reset-zoom enabled", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(true);

    React.act(() => {
      h.app.scrollTo({
        target: [0, 0, 500, 500],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true },
      });
    });

    // reset-zoom stays available (it re-clamps into the lock)
    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(false);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFitSelection)).toBe(
      false,
    );
  });

  it("resets zoom to the locked minimum zoom when zoom is locked", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // a target smaller than the viewport → zoomToTarget fills it at zoom > 1
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    API.setElements([rect]);

    React.act(() => {
      h.app.scrollTo({
        target: rect,
        fit: "contain",
        animation: false,
        lock: { zoom: true },
      });
    });

    const lockedZoom = h.state.scrollConstraints?.zoom;
    expect(lockedZoom).toBeGreaterThan(1);

    // zoom in, then reset → should land back on the locked minimum, not 100%
    React.act(() => {
      h.app.actionManager.executeAction(actionZoomIn);
    });
    expect(h.state.zoom.value).toBeGreaterThan(lockedZoom!);

    React.act(() => {
      h.app.actionManager.executeAction(actionResetZoom);
    });
    expect(h.state.zoom.value).toBeCloseTo(lockedZoom!);
  });

  it("zoom-out cannot go below the locked minimum zoom", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    API.setElements([rect]);

    React.act(() => {
      h.app.scrollTo({
        target: rect,
        fit: "contain",
        animation: false,
        lock: { zoom: true },
      });
    });

    const lockedZoom = h.state.scrollConstraints?.zoom;
    expect(lockedZoom).toBeGreaterThan(1);

    // hammer zoom-out far past the locked floor; it must stay clamped
    for (let i = 0; i < 30; i++) {
      React.act(() => {
        h.app.actionManager.executeAction(actionZoomOut);
      });
    }
    expect(h.state.zoom.value).toBeCloseTo(lockedZoom!);
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
      h.app.scrollTo({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, tolerance: 25 },
      });
    });

    // pan up to (and past) the top edge (hard max scrollY = 0)
    for (let i = 0; i < 20; i++) {
      Keyboard.keyPress(KEYS.PAGE_UP);
    }

    // overscrolled past 0, but bounded by tolerance (25 screen px / zoom 1)
    expect(h.state.scrollY).toBeGreaterThan(0);
    expect(h.state.scrollY).toBeLessThanOrEqual(
      25 / h.state.zoom.value + 0.001,
    );
  });
});
