import React from "react";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import { actionToggleZoomWithScrollWheel } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { GlobalTestState, render } from "./test-utils";

const { h } = window;

// `withBatchedUpdatesThrottled` — which the drag-pan applies pointer movement
// through, once per animation frame — is synchronous under the test setup;
// this lets a test hold the throttled calls back until it releases the frame
const throttle = vi.hoisted(() => {
  const pending = new Set<() => void>();
  return {
    holding: false,
    pending,
    releaseFrame: () => {
      const frames = [...pending];
      pending.clear();
      frames.forEach((frame) => frame());
    },
  };
});

vi.mock("../reactUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../reactUtils")>();
  const withBatchedUpdatesThrottled = (fn: (event?: unknown) => void) => {
    const batched = actual.withBatchedUpdates(fn);
    let run: (() => void) | null = null;
    const frame = () => {
      const pendingRun = run;
      run = null;
      pendingRun?.();
    };
    const ret = (event?: unknown) => {
      if (!throttle.holding) {
        batched(event);
        return;
      }
      run = () => batched(event);
      throttle.pending.add(frame);
    };
    ret.flush = () => {
      throttle.pending.delete(frame);
      frame();
    };
    ret.cancel = () => {
      throttle.pending.delete(frame);
      run = null;
    };
    return ret;
  };
  return { ...actual, withBatchedUpdatesThrottled };
});

// the wheel listener is attached natively on the excalidraw container (not
// via React), so we dispatch a bubbling wheel event from the canvas
const wheel = (init: WheelEventInit) =>
  fireEvent.wheel(GlobalTestState.interactiveCanvas, init);

const getViewport = () => ({
  scrollX: h.state.scrollX,
  scrollY: h.state.scrollY,
  zoom: h.state.zoom.value,
});

/** `MouseEvent.buttons` with only the wheel (middle) button pressed */
const WHEEL_BUTTON = 4;

const wheelButtonPointer = {
  pointerId: 1,
  pointerType: "mouse",
  // `button` identifies the pressed button, `buttons` the held-down set
  button: 1,
  buttons: WHEEL_BUTTON,
  clientX: 100,
  clientY: 100,
};

describe("wheel navigation", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("pans on plain wheel, horizontally with shift, and zooms on ctrl/cmd+wheel", () => {
    const start = getViewport();

    wheel({ deltaX: 30, deltaY: 40 });
    expect(getViewport()).toEqual({
      ...start,
      scrollX: start.scrollX - 30,
      scrollY: start.scrollY - 40,
    });

    const beforeShift = getViewport();
    wheel({ deltaY: 40, shiftKey: true });
    expect(getViewport()).toEqual({
      ...beforeShift,
      scrollX: beforeShift.scrollX - 40,
    });

    const beforeZoom = getViewport();
    wheel({ deltaY: -100, ctrlKey: true });
    const zoomedIn = h.state.zoom.value;
    expect(zoomedIn).toBeGreaterThan(beforeZoom.zoom);
    wheel({ deltaY: 100, metaKey: true });
    expect(h.state.zoom.value).toBeLessThan(zoomedIn);
  });

  describe("wheel button held down", () => {
    it("zooms instead of panning, whatever the modifiers", () => {
      const start = getViewport();

      wheel({ deltaY: -100, buttons: WHEEL_BUTTON });
      const zoomedIn = h.state.zoom.value;
      expect(zoomedIn).toBeGreaterThan(start.zoom);

      wheel({ deltaY: 100, buttons: WHEEL_BUTTON });
      const zoomedOut = h.state.zoom.value;
      expect(zoomedOut).toBeLessThan(zoomedIn);

      // shift would otherwise pan horizontally
      wheel({ deltaY: -100, buttons: WHEEL_BUTTON, shiftKey: true });
      expect(h.state.zoom.value).toBeGreaterThan(zoomedOut);
    });

    it("zooms during the wheel-button drag-pan the button started", () => {
      fireEvent.pointerDown(
        GlobalTestState.interactiveCanvas,
        wheelButtonPointer,
      );

      // the drag-pan owns the viewport: wheel input without the button
      // held is swallowed...
      const start = getViewport();
      wheel({ deltaY: 40 });
      expect(getViewport()).toEqual(start);

      // ...but with the button held, it zooms
      wheel({ deltaY: -100, buttons: WHEEL_BUTTON });
      expect(h.state.zoom.value).toBeGreaterThan(start.zoom);

      fireEvent.pointerUp(window, { ...wheelButtonPointer, buttons: 0 });

      // pan released — plain wheel pans again
      const released = getViewport();
      wheel({ deltaY: 40 });
      expect(h.state.scrollY).toBeCloseTo(
        released.scrollY - 40 / released.zoom,
      );
    });

    describe("while moving the pointer between zooms", () => {
      const moved = { ...wheelButtonPointer, clientX: 130, clientY: 120 };

      /** starts a wheel-button drag-pan; returns the scene point grabbed */
      const grab = () => {
        fireEvent.pointerDown(
          GlobalTestState.interactiveCanvas,
          wheelButtonPointer,
        );
        // wheel zoom anchors on the last pointer position
        fireEvent.pointerMove(
          GlobalTestState.interactiveCanvas,
          wheelButtonPointer,
        );
        return viewportCoordsToSceneCoords(wheelButtonPointer, h.state);
      };

      afterEach(() => {
        // release the pan even when an assertion failed mid-way, so the
        // module-level pan state doesn't leak into the next test
        fireEvent.pointerUp(window, { ...moved, buttons: 0 });
      });

      const expectGrabbedUnderCursor = (grabbed: { x: number; y: number }) => {
        const underCursor = viewportCoordsToSceneCoords(moved, h.state);
        expect(underCursor.x).toBeCloseTo(grabbed.x);
        expect(underCursor.y).toBeCloseTo(grabbed.y);
      };

      it("keeps the zoom when the pan lands in the same React flush", () => {
        const grabbed = grab();
        const startZoom = h.state.zoom.value;

        // the drag-pan's frame runs before React has flushed the zoom the
        // wheel queued, so both land in one flush — a pan written from the
        // pre-zoom state would overwrite the zoom's scroll
        React.act(() => {
          wheel({ deltaY: -100, ...wheelButtonPointer });
          fireEvent.pointerMove(GlobalTestState.interactiveCanvas, moved);
        });

        expect(h.state.zoom.value).toBeGreaterThan(startZoom);
        expectGrabbedUnderCursor(grabbed);
      });

      it("applies a move still waiting for its frame before zooming", () => {
        const grabbed = grab();
        const start = getViewport();

        throttle.holding = true;
        try {
          fireEvent.pointerMove(GlobalTestState.interactiveCanvas, moved);
          expect(getViewport()).toEqual(start);

          wheel({ deltaY: -100, ...moved });
          React.act(() => {
            throttle.releaseFrame();
          });
        } finally {
          throttle.holding = false;
        }

        expect(h.state.zoom.value).toBeGreaterThan(start.zoom);
        expectGrabbedUnderCursor(grabbed);
      });
    });
  });

  describe("zoomWithScrollWheel preference", () => {
    it("is off by default and toggled by its action", () => {
      expect(h.state.zoomWithScrollWheel).toBe(false);
      React.act(() => {
        h.app.actionManager.executeAction(actionToggleZoomWithScrollWheel);
      });
      expect(h.state.zoomWithScrollWheel).toBe(true);
      React.act(() => {
        h.app.actionManager.executeAction(actionToggleZoomWithScrollWheel);
      });
      expect(h.state.zoomWithScrollWheel).toBe(false);
    });

    describe("enabled", () => {
      beforeEach(() => {
        API.setAppState({ zoomWithScrollWheel: true });
      });

      it("zooms on plain wheel and pans vertically on ctrl/cmd+wheel", () => {
        const start = getViewport();
        wheel({ deltaY: -100 });
        expect(h.state.zoom.value).toBeGreaterThan(start.zoom);

        const zoomed = getViewport();
        wheel({ deltaY: 40, ctrlKey: true });
        expect(getViewport()).toEqual({
          ...zoomed,
          scrollY: zoomed.scrollY - 40 / zoomed.zoom,
        });

        const panned = getViewport();
        wheel({ deltaY: 40, metaKey: true });
        expect(getViewport()).toEqual({
          ...panned,
          scrollY: panned.scrollY - 40 / panned.zoom,
        });
      });

      it("keeps shift+wheel panning horizontally", () => {
        const start = getViewport();
        wheel({ deltaY: 40, shiftKey: true });
        expect(getViewport()).toEqual({
          ...start,
          scrollX: start.scrollX - 40 / start.zoom,
        });
      });

      it("keeps zooming with the wheel button held", () => {
        const start = getViewport();
        wheel({ deltaY: -100, buttons: WHEEL_BUTTON, ctrlKey: true });
        expect(h.state.zoom.value).toBeGreaterThan(start.zoom);
      });
    });
  });
});
