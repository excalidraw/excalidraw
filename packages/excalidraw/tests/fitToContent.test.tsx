import React from "react";

import { Excalidraw } from "../index";
import { AnimationController } from "../renderer/animation";
import { SCROLL_TO_CONTENT_ANIMATION_KEY } from "../viewport";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

/**
 * The scroll/zoom animation is driven by `AnimationController`. With render
 * throttling enabled (see the `beforeEach` below) it schedules frames via
 * `requestAnimationFrame`, advancing the easing based on elapsed wall-clock
 * time. We use a very long animation `duration` (see `LONG_ANIMATION_DURATION`)
 * so it can never complete while we sample it, and let a few frames pass
 * between samples so the easing makes observable (but partial) progress.
 */
const LONG_ANIMATION_DURATION = 1_000_000;

const waitForAnimationProgress = (frames = 4) => {
  return act(
    () =>
      new Promise<void>((resolve) => {
        let remaining = frames;
        const step = () => {
          if (--remaining <= 0) {
            resolve();
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      }),
  );
};

/**
 * Polls until the scroll/zoom animation has removed itself from the
 * `AnimationController` (i.e. it ran to completion), or until `maxFrames`
 * elapses as a safety net so a regression can't hang the suite.
 */
const waitForAnimationToStop = (maxFrames = 200) => {
  return act(
    () =>
      new Promise<void>((resolve) => {
        let remaining = maxFrames;
        const check = () => {
          if (
            !AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY) ||
            --remaining <= 0
          ) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      }),
  );
};

describe("scale-down", () => {
  it("should zoom to fit the selected element", async () => {
    await render(<Excalidraw />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 50,
      height: 100,
      x: 50,
      y: 100,
    });
    API.setElements([rectElement]);

    expect(h.state.zoom.value).toBe(1);

    act(() => {
      h.app.scrollTo({
        target: rectElement,
        fit: "scale-down",
        animation: false,
      });
    });

    // element is 10x taller than the viewport size,
    // zoom should be at least 1/10
    expect(h.state.zoom.value).toBeLessThanOrEqual(0.1);
  });

  it("should zoom to fit multiple elements", async () => {
    await render(<Excalidraw />);

    const topLeft = API.createElement({
      width: 20,
      height: 20,
      x: 0,
      y: 0,
    });

    const bottomRight = API.createElement({
      width: 20,
      height: 20,
      x: 80,
      y: 80,
    });
    API.setElements([topLeft, bottomRight]);

    h.state.width = 10;
    h.state.height = 10;

    expect(h.state.zoom.value).toBe(1);

    act(() => {
      h.app.scrollTo({
        target: [topLeft, bottomRight],
        fit: "scale-down",
        animation: false,
      });
    });

    // elements take 100x100, which is 10x bigger than the viewport size,
    // zoom should be at least 1/10
    expect(h.state.zoom.value).toBeLessThanOrEqual(0.1);
  });

  it("should zoom to fit when scrolling to an element by id", async () => {
    await render(<Excalidraw />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 50,
      height: 100,
      x: 50,
      y: 100,
    });

    API.setElements([rectElement]);

    expect(h.state.zoom.value).toBe(1);

    act(() => {
      // navigating by element id (a string target) with zoomToFit
      h.app.scrollTo({
        target: rectElement.id,
        fit: "scale-down",
        animation: false,
      });
    });

    // element is 10x taller than the viewport, so fit-to-content should
    // drop the zoom to <= 1/10
    expect(h.state.zoom.value).toBeLessThanOrEqual(0.1);
  });

  it("should scroll the viewport to the selected element", async () => {
    await render(<Excalidraw />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 100,
      height: 100,
      x: 100,
      y: 100,
    });
    API.setElements([rectElement]);

    expect(h.state.zoom.value).toBe(1);
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    act(() => {
      h.app.scrollTo({
        target: rectElement,
        fit: "contain",
        animation: false,
      });
    });

    expect(h.state.zoom.value).toBe(0.1);

    // state should reflect some scrolling
    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);
  });
});

describe("scale-down animated", () => {
  beforeEach(() => {
    // pace the animation via requestAnimationFrame instead of a tight
    // setTimeout(0) loop, which would otherwise starve the test's own timers
    window.EXCALIDRAW_THROTTLE_RENDER = true;
  });

  afterEach(() => {
    window.EXCALIDRAW_THROTTLE_RENDER = undefined;
    // stop any in-flight scroll/zoom animation so it doesn't keep ticking on
    // the unmounted component and leak into the next test via the singleton
    AnimationController.reset();
  });

  it("should ease scroll the viewport to the selected element", async () => {
    await render(<Excalidraw />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 100,
      height: 100,
      x: -100,
      y: -100,
    });
    API.setElements([rectElement]);

    act(() => {
      h.app.scrollTo({
        target: rectElement,
        fit: "scale-down",
        animation: { duration: LONG_ANIMATION_DURATION },
      });
    });

    // the animation hasn't progressed yet, so we're still at the origin
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    // Since this is an animation, we expect values to change through time.
    await waitForAnimationProgress();

    const prevScrollX = h.state.scrollX;
    const prevScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);

    await waitForAnimationProgress();

    expect(h.state.scrollX).not.toBe(prevScrollX);
    expect(h.state.scrollY).not.toBe(prevScrollY);
  });

  it("should animate the scroll but not the zoom", async () => {
    await render(<Excalidraw />);

    h.state.width = 50;
    h.state.height = 50;

    const rectElement = API.createElement({
      width: 100,
      height: 100,
      x: 100,
      y: 100,
    });
    API.setElements([rectElement]);

    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    act(() => {
      h.app.scrollTo({
        target: rectElement,
        fit: "scale-down",
        animation: { duration: LONG_ANIMATION_DURATION },
      });
    });

    await waitForAnimationProgress();

    const prevScrollX = h.state.scrollX;
    const prevScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);

    await waitForAnimationProgress();

    expect(h.state.scrollX).not.toBe(prevScrollX);
    expect(h.state.scrollY).not.toBe(prevScrollY);
  });

  it("should stop ticking and settle on the target once complete", async () => {
    await render(<Excalidraw />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 100,
      height: 100,
      x: -100,
      y: -100,
    });
    API.setElements([rectElement]);

    act(() => {
      // a short duration so the animation completes within a few frames
      h.app.scrollTo({
        target: rectElement,
        fit: "scale-down",
        animation: { duration: 10 },
      });
    });

    await waitForAnimationToStop();

    // the animation must remove itself from the controller rather than keep
    // ticking forever after reaching the target
    expect(AnimationController.running(SCROLL_TO_CONTENT_ANIMATION_KEY)).toBe(
      false,
    );

    // it should have settled on the target viewport (moved off the origin)
    const settledScrollX = h.state.scrollX;
    const settledScrollY = h.state.scrollY;
    expect(settledScrollX).not.toBe(0);
    expect(settledScrollY).not.toBe(0);
    expect(h.state.shouldCacheIgnoreZoom).toBe(false);

    // further frames must not move the viewport (no perpetual re-rendering)
    await waitForAnimationProgress();
    expect(h.state.scrollX).toBe(settledScrollX);
    expect(h.state.scrollY).toBe(settledScrollY);
  });
});
