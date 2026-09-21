import React from "react";
import { fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import {
  CLASSES,
  MIN_ZOOM,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { resolveInputDevice } from "../appState";
import { Excalidraw } from "../index";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { GlobalTestState, mockBoundingClientRect, render } from "./test-utils";

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

  it("does nothing on a zoom tick at the zoom limit", () => {
    API.setAppState({ zoom: { value: getNormalizedZoom(MIN_ZOOM) } });
    const start = getViewport();

    wheel({ deltaY: 100, ctrlKey: true });

    expect(getViewport()).toEqual(start);
    // in particular no bitmap-cache flip, which would redraw the scene
    expect(h.state.shouldCacheIgnoreZoom).toBe(false);
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

      it.each(["pointerup", "blur", "cleanup"] as const)(
        "broadcasts the final pointer using the committed pan viewport on %s",
        (ending) => {
          const onPointerUpdate = vi.fn();
          GlobalTestState.renderResult.rerender(
            <Excalidraw onPointerUpdate={onPointerUpdate} />,
          );
          grab();
          fireEvent.pointerMove(GlobalTestState.interactiveCanvas, {
            ...wheelButtonPointer,
            clientX: 110,
            clientY: 105,
          });

          const released = {
            ...moved,
            clientX: 150,
            clientY: 140,
            buttons: 0,
          };
          throttle.holding = true;
          try {
            fireEvent.pointerMove(GlobalTestState.interactiveCanvas, moved);
            expect(onPointerUpdate).not.toHaveBeenCalled();
            if (ending === "pointerup") {
              fireEvent.pointerUp(GlobalTestState.interactiveCanvas, released);
            } else if (ending === "blur") {
              fireEvent.blur(window);
            } else {
              React.act(() => h.app.pan.end());
            }
          } finally {
            throttle.holding = false;
          }

          expect(onPointerUpdate).toHaveBeenCalledTimes(1);
          expect(onPointerUpdate).toHaveBeenLastCalledWith(
            expect.objectContaining({
              pointer: {
                ...viewportCoordsToSceneCoords(
                  ending === "pointerup" ? released : moved,
                  h.state,
                ),
                tool: "pointer",
              },
              button: "up",
            }),
          );
        },
      );

      it("keeps drawing from zoom-scaled bitmaps until the gesture is over", async () => {
        grab();

        wheel({ deltaY: -100, ...wheelButtonPointer });
        expect(h.state.shouldCacheIgnoreZoom).toBe(true);

        // a pan frame between two ticks must not switch back to crisp
        // rasterization — that re-rasterizes every element at a zoom the
        // next tick is about to change again
        fireEvent.pointerMove(GlobalTestState.interactiveCanvas, moved);
        expect(h.state.shouldCacheIgnoreZoom).toBe(true);

        wheel({ deltaY: -100, ...moved });
        expect(h.state.shouldCacheIgnoreZoom).toBe(true);

        // ...only once the zoom has been idle for a moment
        await waitFor(() => {
          expect(h.state.shouldCacheIgnoreZoom).toBe(false);
        });
      });
    });
  });

  describe("inputDevice preference", () => {
    it("defaults to auto, which resolves to trackpad until detection exists", () => {
      expect(h.state.inputDevice).toBe("auto");
      expect(resolveInputDevice(h.state.inputDevice)).toBe("trackpad");
    });

    describe.each(["auto", "mouse", "trackpad"] as const)(
      "shift+wheel with %s input",
      (inputDevice) => {
        beforeEach(() => {
          API.setAppState({
            inputDevice,
            zoom: { value: getNormalizedZoom(2) },
            scrollX: 12,
            scrollY: 34,
          });
        });

        it.each([
          { label: "shift+wheel", modifiers: {}, axis: "scrollX" },
          {
            label: "ctrl+shift+wheel",
            modifiers: { ctrlKey: true },
            axis: "scrollY",
          },
          {
            label: "cmd+shift+wheel",
            modifiers: { metaKey: true },
            axis: "scrollY",
          },
        ] as const)("pans only $axis on $label", ({ modifiers, axis }) => {
          const start = getViewport();
          wheel({ deltaX: 10, deltaY: 40, shiftKey: true, ...modifiers });
          expect(getViewport()).toEqual({
            ...start,
            [axis]: start[axis] - 20,
          });

          // A horizontal-only wheel delta must follow the requested axis too.
          wheel({ deltaX: -40, shiftKey: true, ...modifiers });
          expect(getViewport()).toEqual(start);
        });
      },
    );

    describe("mouse", () => {
      beforeEach(() => {
        API.setAppState({ inputDevice: "mouse" });
      });

      it.each([
        { label: "plain wheel", modifiers: {} },
        { label: "ctrl+wheel", modifiers: { ctrlKey: true } },
        { label: "cmd+wheel", modifiers: { metaKey: true } },
      ])("zooms around the pointer on $label", ({ modifiers }) => {
        const pointer = { clientX: 100, clientY: 100 };
        fireEvent.pointerMove(GlobalTestState.interactiveCanvas, pointer);
        const scenePoint = viewportCoordsToSceneCoords(pointer, h.state);
        const start = getViewport();
        wheel({ deltaY: -100, ...modifiers });
        expect(h.state.zoom.value).toBeGreaterThan(start.zoom);

        const zoomedInPoint = viewportCoordsToSceneCoords(pointer, h.state);
        expect(zoomedInPoint.x).toBeCloseTo(scenePoint.x);
        expect(zoomedInPoint.y).toBeCloseTo(scenePoint.y);

        const zoomedIn = h.state.zoom.value;
        wheel({ deltaY: 100, ...modifiers });
        expect(h.state.zoom.value).toBeLessThan(zoomedIn);

        const zoomedOutPoint = viewportCoordsToSceneCoords(pointer, h.state);
        expect(zoomedOutPoint.x).toBeCloseTo(scenePoint.x);
        expect(zoomedOutPoint.y).toBeCloseTo(scenePoint.y);
      });

      it("keeps zooming with the wheel button held", () => {
        const start = getViewport();
        wheel({
          deltaY: -100,
          buttons: WHEEL_BUTTON,
          ctrlKey: true,
          shiftKey: true,
        });
        expect(h.state.zoom.value).toBeGreaterThan(start.zoom);
      });

      it("pans sideways on a horizontal-only wheel instead of zooming", () => {
        // a tilt wheel or a sideways two-finger scroll
        const start = getViewport();
        wheel({ deltaX: 30 });
        expect(getViewport()).toEqual({
          ...start,
          scrollX: start.scrollX - 30 / start.zoom,
        });
        expect(h.state.shouldCacheIgnoreZoom).toBe(false);
      });
    });
  });
});

describe("wheel over a frame label", () => {
  beforeEach(async () => {
    // frame labels render only for frames inside the measured viewport
    mockBoundingClientRect();
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(200));
  });

  it("is handled once", async () => {
    const frame = API.createElement({
      type: "frame",
      x: 20,
      y: 30,
      width: 80,
      height: 50,
    });
    API.setElements([frame]);
    const label = await waitFor(() => {
      const element = document.querySelector(`.${CLASSES.FRAME_NAME}`);
      expect(element).not.toBe(null);
      return element as HTMLElement;
    });

    // the label is DOM inside the editor container, whose wheel listener
    // accepts it; a React `onWheel` on the label itself used to handle the
    // same event a second time, panning and zooming twice per tick
    const start = getViewport();
    fireEvent.wheel(label, { deltaY: 40 });
    expect(h.state.scrollY).toBeCloseTo(start.scrollY - 40 / start.zoom);
  });
});
