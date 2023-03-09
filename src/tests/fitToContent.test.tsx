import { render } from "./test-utils";
import { API } from "./helpers/api";

import ExcalidrawApp from "../excalidraw-app";

const { h } = window;

describe("fitToContent", () => {
  it("should zoom to fit the selected element", async () => {
    await render(<ExcalidrawApp />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 50,
      height: 100,
      x: 50,
      y: 100,
    });

    expect(h.state.zoom.value).toBe(1);

    h.app.scrollToContent(rectElement, { fitToContent: true });

    // element is 10x taller than the stage,
    // zoom should be at least 1/10
    expect(h.state.zoom.value).toBeLessThanOrEqual(0.1);
  });

  it("should zoom to fit multiple elements", async () => {
    await render(<ExcalidrawApp />);

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

    h.app.scrollToContent([topLeft, bottomRight], {
      fitToContent: true,
    });

    // elements take 100x100, which is 10x bigger than the stage,
    // zoom should be at least 1/10
    expect(h.state.zoom.value).toBeLessThanOrEqual(0.1);
  });

  it("should scroll the viewport to the selected element", async () => {
    await render(<ExcalidrawApp />);

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

    h.app.scrollToContent(rectElement);

    // zoom level should stay the same
    expect(h.state.zoom.value).toBe(1);

    // state should reflect some scrolling
    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);
  });
});

const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("fitToContent animated", () => {
  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should ease scroll the viewport to the selected element", async () => {
    await render(<ExcalidrawApp />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 100,
      height: 100,
      x: -100,
      y: -100,
    });

    h.app.scrollToContent(rectElement, { animate: true });

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    // Since this is an animation, we expect values to change through time.
    // We'll verify that the scroll values change at 50ms and 100ms
    expect(h.state.scrollX).toBe(0);
    expect(h.state.scrollY).toBe(0);

    // wait around the 50ms mark
    await waitFor(50);

    const pastScrollX = h.state.scrollX;
    const pastScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);

    // wait around the 100ms mark (+50ms)
    await waitFor(50);
    expect(h.state.scrollX).not.toBe(pastScrollX);
    expect(h.state.scrollY).not.toBe(pastScrollY);
  });

  it("should animate the scroll but not the zoom", async () => {
    await render(<ExcalidrawApp />);

    h.state.width = 10;
    h.state.height = 10;

    const rectElement = API.createElement({
      width: 100,
      height: 100,
      x: 100,
      y: 100,
    });

    h.app.scrollToContent(rectElement, { animate: true, fitToContent: true });

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    // Since this is an animation, we expect values to change through time.
    // We'll verify that the zoom and scroll values changes at 50ms and 100ms
    expect(h.state.scrollY).toBe(0);
    expect(h.state.scrollY).toBe(0);

    // zoom is not animated, it should be already be set to its final value
    expect(h.state.zoom.value).toBeLessThanOrEqual(0.1);

    // wait around the 50ms mark
    await waitFor(50);

    const pastScrollX = h.state.scrollX;
    const pastScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(0);
    expect(h.state.scrollY).not.toBe(0);

    // wait around the 100ms mark (+50ms)
    await waitFor(50);
    expect(h.state.scrollX).not.toBe(pastScrollX);
    expect(h.state.scrollY).not.toBe(pastScrollY);
  });
});
