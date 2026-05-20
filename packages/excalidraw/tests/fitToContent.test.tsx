import React from "react";
import { vi } from "vitest";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

const waitForNextAnimationFrame = () => {
  return act(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
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
    vi.spyOn(window, "requestAnimationFrame");
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      h.app.scrollToContent(rectElement, { animate: true });
    });

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    // Since this is an animation, we expect values to change through time.
    // We'll verify that the scroll values change at 50ms and 100ms
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    await waitForNextAnimationFrame();

    const prevScrollX = h.state.scrollX;
    const prevScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);

    await waitForNextAnimationFrame();

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
      h.app.scrollToContent(rectElement, { animate: true, fitToContent: true });
    });

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    await waitForNextAnimationFrame();

    const prevScrollX = h.state.scrollX;
    const prevScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);

    await waitForNextAnimationFrame();

    expect(h.state.scrollX).not.toBe(prevScrollX);
    expect(h.state.scrollY).not.toBe(prevScrollY);
  });
});
