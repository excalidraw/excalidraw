import React from "react";

import { KEYS, MAX_ZOOM } from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionResetZoom,
  actionZoomToFit,
  actionZoomToFitSelection,
} from "../actions/actionCanvas";
import { getNormalizedZoom } from "../scene";
import { constrainScrollState, getMinZoomForConstraints } from "../scroll";

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

describe("setScrollConstraints (integration)", () => {
  beforeEach(() => {
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("snaps the current viewport inside the box when constraints are set", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));

    // start well outside the future box
    React.act(() => {
      h.app.setScrollConstraints({ x: 0, y: 0, width: 1000, height: 1000 });
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
      h.app.setScrollConstraints({ x: 0, y: 0, width: 300, height: 200 });
    });

    // hammer page-down (pans down) far past the box; scroll must stay clamped
    for (let i = 0; i < 20; i++) {
      Keyboard.keyPress(KEYS.PAGE_DOWN);
    }
    expect(h.state.scrollY).toBeGreaterThanOrEqual(h.state.height - 200);

    // clearing constraints lets it scroll freely again
    React.act(() => {
      h.app.setScrollConstraints(null);
    });
    const before = h.state.scrollY;
    Keyboard.keyPress(KEYS.PAGE_DOWN);
    expect(h.state.scrollY).toBeLessThan(before);
  });

  it("disables reset-zoom and zoom-to-fit actions while constrained", async () => {
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(true);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(true);

    React.act(() => {
      h.app.setScrollConstraints({ x: 0, y: 0, width: 500, height: 500 });
    });

    expect(h.app.actionManager.isActionEnabled(actionResetZoom)).toBe(false);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFit)).toBe(false);
    expect(h.app.actionManager.isActionEnabled(actionZoomToFitSelection)).toBe(
      false,
    );
  });
});
