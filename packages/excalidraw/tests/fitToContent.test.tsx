import React from "react";

import { Excalidraw } from "../index";
import { AnimationController } from "../renderer/animation";

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

describe("fitToContent", () => {
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

    expect(h.state.zoom.value).toBe(1);

    act(() => {
      h.app.scrollToContent(rectElement, { fitToContent: true });
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

    h.state.width = 10;
    h.state.height = 10;

    expect(h.state.zoom.value).toBe(1);

    act(() => {
      h.app.scrollToContent([topLeft, bottomRight], {
        fitToContent: true,
      });
    });

    // elements take 100x100, which is 10x bigger than the viewport size,
    // zoom should be at least 1/10
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

    expect(h.state.zoom.value).toBe(1);
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    act(() => {
      h.app.scrollToContent(rectElement);
    });

    // zoom level should stay the same
    expect(h.state.zoom.value).toBe(1);

    // state should reflect some scrolling
    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);
  });
});

describe("fitToContent animated", () => {
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

    act(() => {
      h.app.scrollToContent(rectElement, {
        animate: true,
        duration: LONG_ANIMATION_DURATION,
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

    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    act(() => {
      h.app.scrollToContent(rectElement, {
        animate: true,
        fitToContent: true,
        duration: LONG_ANIMATION_DURATION,
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
});
