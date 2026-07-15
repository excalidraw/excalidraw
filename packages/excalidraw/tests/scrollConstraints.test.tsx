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
  snapBackToConstraints,
  SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY,
  SCROLL_TO_CONTENT_ANIMATION_KEY,
} from "../components/App.viewport";
import {
  constrainScrollState,
  DEFAULT_OVERSCROLL,
  getViewportForZoomWithScrollConstraints,
  isViewportOverscrolled,
} from "../viewport";
import { AnimationController } from "../renderer/animation";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
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
 * `overscroll`/`offsets` to override. */
const makeLock = (
  overrides: Partial<ScrollConstraints> &
    Pick<ScrollConstraints, "x" | "y" | "width" | "height">,
): ScrollConstraints => ({
  lockScroll: false,
  lockZoom: false,
  zoom: 1,
  overscroll: 0,
  ...overrides,
});

const waitForAnimationToStop = (key: string, maxFrames = 200) => {
  return React.act(
    () =>
      new Promise<void>((resolve) => {
        let remaining = maxFrames;
        const check = () => {
          if (!AnimationController.running(key) || --remaining <= 0) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      }),
  );
};

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

describe("offsets (pure)", () => {
  const base = { x: 0, y: 0, width: 1000, height: 1000 } as const;

  it("extends the scrollable area past each edge", () => {
    const offsets = { top: 10, right: 20, bottom: 30, left: 40 };
    const lock = makeLock({ ...base, lockScroll: true, offsets });

    // pan past the top-left corner → clamp to the offsets corner
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

  it("keeps the offsets a fixed screen distance regardless of zoom", () => {
    // 40 screen px of top offset at zoom 2 → 20 scene px
    const result = constrainScrollState(
      makeState({
        scrollY: 999,
        zoom: { value: getNormalizedZoom(2) },
        scrollConstraints: makeLock({
          ...base,
          lockScroll: true,
          offsets: { top: 40 },
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

  it("stacks with the rubberband overscroll", () => {
    const overscroll = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({
          ...base,
          lockScroll: true,
          overscroll,
          offsets: { left: 40 },
        }),
      }),
      overscroll,
    );
    // left offset (40) + overscroll give (30) at zoom 1
    expect(result.scrollX).toBeCloseTo(70);
  });
});

describe("rubberband overscroll (pure)", () => {
  const base = { x: 0, y: 0, width: 1000, height: 1000 } as const;

  it("allows scroll overscroll up to `overscroll` screen pixels", () => {
    const overscroll = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({ ...base, lockScroll: true, overscroll }),
      }),
      overscroll,
    );
    expect(result.scrollX).toBeCloseTo(overscroll / 1); // 30 (zoom 1)
  });

  it("keeps the overscroll a fixed screen distance regardless of zoom", () => {
    const overscroll = 30; // screen px
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        zoom: { value: getNormalizedZoom(2) },
        scrollConstraints: makeLock({ ...base, lockScroll: true, overscroll }),
      }),
      overscroll,
    );
    // 30 screen px at zoom 2 -> 15 scene px of overscroll
    expect(result.scrollX).toBeCloseTo(overscroll / 2); // 15
  });

  it("hard-clamps when overscroll is 0 (default)", () => {
    const result = constrainScrollState(
      makeState({
        scrollX: 999,
        scrollConstraints: makeLock({ ...base, lockScroll: true }),
      }),
    );
    expect(result.scrollX).toBeCloseTo(0);
  });

  it("gives ±overscroll around center when the box can't cover the viewport", () => {
    const overscroll = 30; // screen px
    // at zoom 0.1 the visible width (200/0.1 = 2000) exceeds the box (1000),
    // so the box rests centered (scrollX 500) — but overscroll must still
    // allow give around that resting position, regardless of the free space
    const state = makeState({
      scrollX: 9999,
      zoom: { value: getNormalizedZoom(0.1) },
      scrollConstraints: makeLock({ ...base, lockScroll: true, overscroll }),
    });

    // 30 screen px at zoom 0.1 -> 300 scene px of give past center
    expect(constrainScrollState(state, overscroll).scrollX).toBeCloseTo(
      500 + 300,
    );
    // the hard clamp still rests at dead center
    expect(constrainScrollState(state).scrollX).toBeCloseTo(500);
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
    snapBackToConstraints(
      makeState({ scrollX: 200, scrollConstraints: lock }),
      onFrame,
    );
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(true);
    expect(onFrame).toHaveBeenCalled();
  });

  it("is a no-op when already within the box", () => {
    const onFrame = vi.fn();
    snapBackToConstraints(
      makeState({ scrollX: -100, scrollConstraints: lock }),
      onFrame,
    );
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(false);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it("does not supersede an active viewport navigation", () => {
    AnimationController.start(SCROLL_TO_CONTENT_ANIMATION_KEY, () => ({}));

    snapBackToConstraints(
      makeState({ scrollX: 200, scrollConstraints: lock }),
      vi.fn(),
    );

    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      true,
    );
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(false);
  });
});

describe("getViewportForZoomWithScrollConstraints", () => {
  it("preserves the screen-space overscroll distance while zooming", () => {
    const state = {
      ...makeState({
        scrollY: 50,
        scrollConstraints: makeLock({
          x: 0,
          y: 0,
          width: 1000,
          height: 1000,
          lockScroll: true,
          overscroll: 50,
        }),
      }),
      offsetLeft: 0,
      offsetTop: 0,
    } as AppState;

    const viewport = getViewportForZoomWithScrollConstraints(
      {
        viewportX: 0,
        viewportY: 0,
        nextZoom: getNormalizedZoom(2),
      },
      state,
    );
    const restingViewport = constrainScrollState({ ...state, ...viewport });

    expect(viewport.zoom.value).toBe(2);
    expect(
      (viewport.scrollY - restingViewport.scrollY) * viewport.zoom.value,
    ).toBeCloseTo(50);
  });
});

describe("setViewport lock (integration)", () => {
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
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: false },
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
      h.app.viewport.setViewport(null);
    });
    expect(h.state.scrollConstraints).toBe(null);
    const before = h.state.scrollY;
    Keyboard.keyPress(KEYS.PAGE_DOWN);
    expect(h.state.scrollY).toBeLessThan(before);
  });

  it("withholds user viewport input until an animated lock settles", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
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
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true },
      });
    });
    expect(h.state.scrollConstraints).not.toBe(null);

    window.EXCALIDRAW_THROTTLE_RENDER = true;
    try {
      React.act(() => {
        h.app.viewport.setViewport({
          target: rect,
          fit: "scale-down",
          animation: { duration: 10 },
          lock: { scroll: true },
        });
      });

      // the animation is in flight and the lock has NOT been installed yet —
      // it's chained to run once the scroll settles
      expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
        true,
      );
      // The previous active lock is superseded immediately; the destination
      // lock is held internally until the animation lands.
      expect(h.state.scrollConstraints).toBe(null);
      expect(h.app.viewport.isLockedTransitionPending).toBe(true);

      const viewportDuringTransition = {
        scrollX: h.state.scrollX,
        scrollY: h.state.scrollY,
        zoom: h.state.zoom.value,
      };

      // Pan, wheel/pinch zoom, zoom controls, and fit actions are all
      // consumed while the pending lock owns the viewport. None may cancel
      // the animation or perturb its current frame.
      Keyboard.keyPress(KEYS.PAGE_DOWN);
      fireEvent.wheel(GlobalTestState.interactiveCanvas, {
        ctrlKey: true,
        deltaY: -10,
      });
      React.act(() => {
        h.app.actionManager.executeAction(actionZoomIn, "ui");
        h.app.actionManager.executeAction(actionResetZoom, "ui");
        h.app.actionManager.executeAction(actionZoomToFit, "ui");
        h.app.actionManager.executeAction(actionZoomToFitSelection, "ui");
      });

      expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
        true,
      );
      expect({
        scrollX: h.state.scrollX,
        scrollY: h.state.scrollY,
        zoom: h.state.zoom.value,
      }).toEqual(viewportDuringTransition);

      await waitForAnimationToStop(SCROLL_TO_CONTENT_ANIMATION_KEY);

      expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
        false,
      );
      expect(h.app.viewport.isLockedTransitionPending).toBe(false);
      expect(h.state.scrollConstraints).toMatchObject({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        lockScroll: true,
      });
    } finally {
      window.EXCALIDRAW_THROTTLE_RENDER = undefined;
    }
  });

  it("lets a newer animated lock supersede an older one", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const firstTarget = API.createElement({
      type: "rectangle",
      x: 1000,
      y: 1000,
      width: 100,
      height: 100,
    });
    const secondTarget = API.createElement({
      type: "rectangle",
      x: 3000,
      y: 3000,
      width: 200,
      height: 200,
    });
    API.setElements([firstTarget, secondTarget]);

    window.EXCALIDRAW_THROTTLE_RENDER = true;
    try {
      React.act(() => {
        h.app.viewport.setViewport({
          target: firstTarget,
          animation: { duration: 1000 },
          lock: { scroll: true },
        });
      });

      expect(h.app.viewport.isLockedTransitionPending).toBe(true);

      React.act(() => {
        h.app.viewport.setViewport({
          target: secondTarget,
          animation: { duration: 10 },
          lock: { scroll: true, zoom: true },
        });
      });

      expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
        true,
      );
      expect(h.app.viewport.isLockedTransitionPending).toBe(true);

      await waitForAnimationToStop(SCROLL_TO_CONTENT_ANIMATION_KEY);

      expect(h.app.viewport.isLockedTransitionPending).toBe(false);
      expect(h.state.scrollConstraints).toMatchObject({
        x: secondTarget.x,
        y: secondTarget.y,
        width: secondTarget.width,
        height: secondTarget.height,
        lockScroll: true,
        lockZoom: true,
      });
    } finally {
      window.EXCALIDRAW_THROTTLE_RENDER = undefined;
    }
  });

  it("clears both active and pending locks with setViewport(null)", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        animation: false,
        lock: { scroll: true },
      });
    });
    expect(h.state.scrollConstraints).not.toBe(null);

    React.act(() => {
      h.app.viewport.setViewport({
        target: [2000, 2000, 3000, 3000],
        animation: { duration: 1000 },
        lock: { scroll: true, zoom: true },
      });
    });

    // The superseded active lock is removed while the target lock is pending.
    expect(h.state.scrollConstraints).toBe(null);
    expect(h.app.viewport.isLockedTransitionPending).toBe(true);

    React.act(() => {
      h.app.viewport.setViewport(null);
    });

    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      false,
    );
    expect(h.app.viewport.isLockedTransitionPending).toBe(false);
    expect(h.state.scrollConstraints).toBe(null);
    expect(h.state.shouldCacheIgnoreZoom).toBe(false);
  });

  it("still lets user input cancel an unlocked viewport animation", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [2000, 2000, 3000, 3000],
        animation: { duration: 1000 },
      });
    });

    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      true,
    );
    expect(h.app.viewport.isLockedTransitionPending).toBe(false);

    React.act(() => {
      h.app.viewport.translate({ scrollX: 123, scrollY: 456 });
    });

    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      false,
    );
    expect(h.state.scrollX).toBe(123);
    expect(h.state.scrollY).toBe(456);
  });

  it("applies back-to-back lock updates in call order", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        animation: false,
        lock: { scroll: true },
      });
      h.app.viewport.setViewport({
        target: [1000, 1000, 2000, 2000],
        animation: false,
        lock: { scroll: true, zoom: true },
      });
      h.app.viewport.setViewport({
        target: [2000, 2000, 3000, 3000],
        animation: false,
      });
    });

    expect(h.state.scrollConstraints).toBe(null);
    expect(h.state.zoom.value).toBeCloseTo(0.1);
    expect(h.state.scrollX).toBeCloseTo(-1500);
    expect(h.state.scrollY).toBeCloseTo(-2000);
  });

  it("supports rect targets and defaults missing dimensions to the viewport", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
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
      h.app.viewport.setViewport({
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
      h.app.viewport.setViewport({
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
      "supplied element target(s) for setViewport contain deleted or non-existent elements which have been filtered out";

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
        h.app.viewport.setViewport({
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
        h.app.viewport.setViewport({
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

  it("keeps zoom-to-fit actions enabled while locked, fitting the locked box", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(true);

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 500, 500],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, zoom: true },
      });
    });

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFitSelection)).toBe(
      true,
    );

    const restingViewport = {
      scrollX: h.state.scrollX,
      scrollY: h.state.scrollY,
      zoom: h.state.zoom.value,
    };

    // zoom & pan away from the resting viewport...
    React.act(() => {
      h.app.actionManager.executeAction(actionZoomIn);
      h.app.actionManager.executeAction(actionZoomIn);
    });
    expect(h.state.zoom.value).toBeGreaterThan(restingViewport.zoom);

    // ...then zoom-to-fit → lands back on the locked box, not the elements
    // (the scene is empty, so fitting elements would be degenerate anyway)
    React.act(() => {
      h.app.actionManager.executeAction(actionZoomToFit);
    });
    expect(h.state.zoom.value).toBeCloseTo(restingViewport.zoom);
    expect(h.state.scrollX).toBeCloseTo(restingViewport.scrollX);
    expect(h.state.scrollY).toBeCloseTo(restingViewport.scrollY);
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
      h.app.viewport.setViewport({
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
      h.app.viewport.setViewport({
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

describe("rubberband overscroll (integration)", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
    AnimationController.reset();
  });

  it("lets the user pan past the box edge (bounded by overscroll)", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 25 },
      });
    });

    // pan up to (and past) the top edge (hard max scrollY = 0)
    for (let i = 0; i < 20; i++) {
      Keyboard.keyPress(KEYS.PAGE_UP);
    }

    // overscrolled past 0, but bounded by the give (25 screen px / zoom 1)
    expect(h.state.scrollY).toBeGreaterThan(0);
    expect(h.state.scrollY).toBeLessThanOrEqual(
      25 / h.state.zoom.value + 0.001,
    );
  });

  it("hard-clamps interactive zoom so it never enters the overscroll zone", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 50 },
      });
    });

    // fitted at zoom 0.1; the box rests centered horizontally (scrollX 500)
    expect(h.state.zoom.value).toBeCloseTo(0.1);
    expect(h.state.scrollX).toBeCloseTo(500);

    // interactive zoom-in anchored at the top-left corner (the wheel-zoom
    // path): keeping that focal point fixed would leave scrollX at 500,
    // which at zoom 0.2 is 100 screen px past the hard bound (scrollX 0) —
    // outside the 50px give. The zoom must be hard-clamped (equivalent to
    // sliding the zoom origin back into bounds), not rubberbanded.
    React.act(() => {
      h.app.viewport.translate((state: AppState) => ({
        ...getViewportForZoomWithScrollConstraints(
          { viewportX: 0, viewportY: 0, nextZoom: getNormalizedZoom(0.2) },
          state,
        ),
      }));
    });

    expect(h.state.zoom.value).toBeCloseTo(0.2);
    expect(h.state.scrollX).toBeCloseTo(0);
    expect(isViewportOverscrolled(h.state)).toBe(false);

    // panning, by contrast, still gets the rubberband give
    Keyboard.keyPress(KEYS.PAGE_UP);
    expect(h.state.scrollY).toBeGreaterThan(0);
    expect(h.state.scrollY).toBeLessThanOrEqual(
      50 / h.state.zoom.value + 0.001,
    );
  });

  it("allows simultaneous pinch-zoom and rubberband pan on touch", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 50 },
      });
    });

    // fitted at zoom 0.1; the box exactly fills the viewport vertically,
    // so the hard bound is scrollY = 0
    const initialZoom = h.state.zoom.value;
    expect(initialZoom).toBeCloseTo(0.1);
    expect(h.state.scrollY).toBeCloseTo(0);

    const finger1 = new Pointer("touch", 1);
    const finger2 = new Pointer("touch", 2);

    // spread the fingers (zoom in) while dragging both downward (pan past
    // the top edge) — in a single two-finger gesture. Anchored near the top
    // edge so the zoom's focal scroll doesn't counteract the pan.
    finger1.downAt(50, 2);
    finger2.downAt(60, 2);
    finger1.move(-2, 5);
    finger2.move(2, 5);

    // zoomed in AND overscrolled past the top edge, bounded by the give
    expect(h.state.zoom.value).toBeGreaterThan(initialZoom);
    expect(h.state.scrollY).toBeGreaterThan(0);
    expect(h.state.scrollY).toBeLessThanOrEqual(
      50 / h.state.zoom.value + 0.001,
    );
    expect(isViewportOverscrolled(h.state)).toBe(true);

    // zooming must keep working while overscrolled (used to be pinned),
    // without yanking the viewport back inside the box
    const zoomedWhileOverscrolled = h.state.zoom.value;
    finger1.move(-2, 0);
    finger2.move(2, 0);
    expect(h.state.zoom.value).toBeGreaterThan(zoomedWhileOverscrolled);
    expect(h.state.scrollY).toBeGreaterThan(0);

    finger1.up();
    finger2.up();
  });

  it("withholds the rubberband snap-back until the touch gesture ends", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 50 },
      });
    });

    const finger1 = new Pointer("touch", 1);
    const finger2 = new Pointer("touch", 2);

    // two-finger pan past the top edge, into the overscroll zone
    finger1.downAt(50, 2);
    finger2.downAt(60, 2);
    finger1.move(0, 5);
    finger2.move(0, 5);
    expect(isViewportOverscrolled(h.state)).toBe(true);

    // the debounced snap-back elapses while the fingers are still down —
    // it must be withheld, not fight the held gesture
    React.act(() => {
      // eslint-disable-next-line dot-notation -- private; simulates the debounce delay elapsing
      h.app.viewport["snapBackDebounced"].flush();
    });
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(false);
    expect(isViewportOverscrolled(h.state)).toBe(true);

    // lifting one finger ends the gesture → the rubberband releases
    finger1.up();
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(true);

    finger2.up();
  });

  it("withholds the rubberband snap-back until a desktop pan ends", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 50 },
      });
      h.app.setActiveTool({ type: "hand" });
    });

    const mouse = new Pointer("mouse");

    // Drag down past the top edge and hold the mouse button there.
    mouse.downAt(50, 2);
    mouse.move(0, 5);
    expect(isViewportOverscrolled(h.state)).toBe(true);

    // The debounce may elapse while the mouse is still held, but the viewport
    // must remain attached to the pointer until the pan session ends.
    React.act(() => {
      // eslint-disable-next-line dot-notation -- private; simulates the debounce delay elapsing
      h.app.viewport["snapBackDebounced"].flush();
    });
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(false);
    expect(isViewportOverscrolled(h.state)).toBe(true);

    mouse.up();
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(true);

    // Direct manipulation takes ownership of the viewport again.
    mouse.downAt(50, 7);
    mouse.move(0, 1);
    expect(
      AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
    ).toBe(false);
    mouse.up();
  });

  it("continues rubberband snap-back while wheel-zooming", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    React.act(() => {
      h.app.viewport.setViewport({
        target: [0, 0, 1000, 1000],
        fit: "scale-down",
        animation: false,
        lock: { scroll: true, overscroll: 50 },
      });
      h.app.setActiveTool({ type: "hand" });
    });

    const mouse = new Pointer("mouse");
    window.EXCALIDRAW_THROTTLE_RENDER = true;
    try {
      mouse.downAt(50, 2);
      mouse.move(0, 5);
      mouse.up();

      expect(
        AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
      ).toBe(true);
      expect(isViewportOverscrolled(h.state)).toBe(true);

      const zoomBefore = h.state.zoom.value;
      fireEvent.wheel(GlobalTestState.interactiveCanvas, {
        ctrlKey: true,
        deltaY: -10,
      });

      expect(h.state.zoom.value).toBeGreaterThan(zoomBefore);
      expect(isViewportOverscrolled(h.state)).toBe(true);
      expect(
        AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
      ).toBe(true);

      await waitForAnimationToStop(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY);

      expect(
        AnimationController.running(SCROLL_CONSTRAINTS_SNAP_BACK_ANIMATION_KEY),
      ).toBe(false);
      expect(h.state.zoom.value).toBeGreaterThan(zoomBefore);
      expect(isViewportOverscrolled(h.state)).toBe(false);
    } finally {
      window.EXCALIDRAW_THROTTLE_RENDER = undefined;
    }
  });

  it("defaults to DEFAULT_OVERSCROLL when omitted or `true`, 0 when `false`", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    const install = (overscroll?: boolean | number) => {
      React.act(() => {
        h.app.viewport.setViewport({
          target: [0, 0, 1000, 1000],
          fit: "scale-down",
          animation: false,
          lock: { scroll: true, overscroll },
        });
      });
    };

    install(undefined);
    expect(h.state.scrollConstraints?.overscroll).toBe(DEFAULT_OVERSCROLL);

    install(true);
    expect(h.state.scrollConstraints?.overscroll).toBe(DEFAULT_OVERSCROLL);

    install(false);
    expect(h.state.scrollConstraints?.overscroll).toBe(0);

    install(25);
    expect(h.state.scrollConstraints?.overscroll).toBe(25);
  });
});
