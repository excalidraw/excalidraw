import React from "react";

import { KEYS, POINTER_BUTTON, ZOOM_STEP } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  fireEvent,
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;
const MIDDLE_MOUSE_BUTTON_MASK = 4;

describe("appState", () => {
  it("scroll-to-content on init works with non-zero offsets", async () => {
    const WIDTH = 200;
    const HEIGHT = 100;
    const OFFSET_LEFT = 20;
    const OFFSET_TOP = 10;

    const ELEM_WIDTH = 100;
    const ELEM_HEIGHT = 60;

    mockBoundingClientRect();

    await render(
      <div>
        <Excalidraw
          initialData={{
            elements: [
              API.createElement({
                type: "rectangle",
                id: "A",
                width: ELEM_WIDTH,
                height: ELEM_HEIGHT,
              }),
            ],
            scrollToContent: true,
          }}
        />
      </div>,
    );
    await waitFor(() => {
      expect(h.state.width).toBe(200);
      expect(h.state.height).toBe(100);
      expect(h.state.offsetLeft).toBe(OFFSET_LEFT);
      expect(h.state.offsetTop).toBe(OFFSET_TOP);

      // assert scroll is in center
      expect(h.state.scrollX).toBe(WIDTH / 2 - ELEM_WIDTH / 2);
      expect(h.state.scrollY).toBe(HEIGHT / 2 - ELEM_HEIGHT / 2);
    });
    restoreOriginalGetBoundingClientRect();
  });

  it("moving by page up/down/left/right", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />, {});

    const scrollTest = () => {
      const initialScrollY = h.state.scrollY;
      const initialScrollX = h.state.scrollX;
      const pageStepY = h.state.height / h.state.zoom.value;
      const pageStepX = h.state.width / h.state.zoom.value;
      // Assert the following assertions have meaning
      expect(pageStepY).toBeGreaterThan(0);
      expect(pageStepX).toBeGreaterThan(0);
      // Assert we scroll up
      Keyboard.keyPress(KEYS.PAGE_UP);
      expect(h.state.scrollY).toBe(initialScrollY + pageStepY);
      // x-axis unchanged
      expect(h.state.scrollX).toBe(initialScrollX);

      // Assert we scroll down
      Keyboard.keyPress(KEYS.PAGE_DOWN);
      Keyboard.keyPress(KEYS.PAGE_DOWN);
      expect(h.state.scrollY).toBe(initialScrollY - pageStepY);
      // x-axis unchanged
      expect(h.state.scrollX).toBe(initialScrollX);

      // Assert we scroll left
      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(KEYS.PAGE_UP);
      });
      expect(h.state.scrollX).toBe(initialScrollX + pageStepX);
      // y-axis unchanged
      expect(h.state.scrollY).toBe(initialScrollY - pageStepY);

      // Assert we scroll right
      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(KEYS.PAGE_DOWN);
        Keyboard.keyPress(KEYS.PAGE_DOWN);
      });
      expect(h.state.scrollX).toBe(initialScrollX - pageStepX);
      // y-axis unchanged
      expect(h.state.scrollY).toBe(initialScrollY - pageStepY);
    };

    const zoom = h.state.zoom.value;
    // Assert we scroll properly when zoomed in
    API.setAppState({ zoom: { value: (zoom * 1.1) as typeof zoom } });
    scrollTest();
    // Assert we scroll properly when zoomed out
    API.setAppState({ zoom: { value: (zoom * 0.9) as typeof zoom } });
    scrollTest();
    // Assert we scroll properly with normal zoom
    API.setAppState({ zoom: { value: zoom } });
    scrollTest();
    restoreOriginalGetBoundingClientRect();
  });

  it("zooms with middle mouse button and wheel", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const canvas = GlobalTestState.interactiveCanvas;
    const initialZoom = h.state.zoom.value;

    fireEvent.pointerDown(canvas, {
      button: POINTER_BUTTON.WHEEL,
      buttons: MIDDLE_MOUSE_BUTTON_MASK,
      clientX: 100,
      clientY: 100,
      pointerType: "mouse",
    });
    fireEvent.wheel(canvas, {
      buttons: MIDDLE_MOUSE_BUTTON_MASK,
      clientX: 100,
      clientY: 100,
      deltaY: -100,
    });
    expect(h.state.zoom.value).toBeCloseTo(initialZoom + ZOOM_STEP);

    fireEvent.wheel(canvas, {
      buttons: MIDDLE_MOUSE_BUTTON_MASK,
      clientX: 100,
      clientY: 100,
      deltaY: 100,
    });
    expect(h.state.zoom.value).toBeCloseTo(initialZoom);

    fireEvent.pointerUp(window, {
      button: POINTER_BUTTON.WHEEL,
      buttons: 0,
      clientX: 100,
      clientY: 100,
      pointerType: "mouse",
    });

    restoreOriginalGetBoundingClientRect();
  });

  it("keeps normal wheel scrolling when middle mouse button is not pressed", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const canvas = GlobalTestState.interactiveCanvas;
    const initialZoom = h.state.zoom.value;
    const initialScrollY = h.state.scrollY;

    fireEvent.wheel(canvas, {
      buttons: 0,
      clientX: 100,
      clientY: 100,
      deltaY: 100,
    });

    expect(h.state.zoom.value).toBe(initialZoom);
    expect(h.state.scrollY).toBe(initialScrollY - 100 / initialZoom);

    restoreOriginalGetBoundingClientRect();
  });

  it("keeps middle mouse drag panning", async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const canvas = GlobalTestState.interactiveCanvas;
    const initialScrollX = h.state.scrollX;
    const initialScrollY = h.state.scrollY;

    fireEvent.pointerDown(canvas, {
      button: POINTER_BUTTON.WHEEL,
      buttons: MIDDLE_MOUSE_BUTTON_MASK,
      clientX: 100,
      clientY: 100,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(window, {
      buttons: MIDDLE_MOUSE_BUTTON_MASK,
      clientX: 80,
      clientY: 70,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(window, {
      button: POINTER_BUTTON.WHEEL,
      buttons: 0,
      clientX: 80,
      clientY: 70,
      pointerType: "mouse",
    });

    expect(h.state.scrollX).toBe(initialScrollX - 20);
    expect(h.state.scrollY).toBe(initialScrollY - 30);

    restoreOriginalGetBoundingClientRect();
  });
});
