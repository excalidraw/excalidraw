import React from "react";

import { KEYS } from "@excalidraw/common";
import { newElementWith, sortFramesInReadingOrder } from "@excalidraw/element";

import { Excalidraw } from "../index";
import {
  actionPresentFromFrame,
  actionTogglePresentation,
} from "../actions/actionPresentation";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render, screen } from "./test-utils";

const { h } = window;

const createFrame = (id: string, x: number, y: number) =>
  API.createElement({ type: "frame", id, x, y, width: 400, height: 300 });

describe("sortFramesInReadingOrder", () => {
  it("orders frames in reading order (rows, then left-to-right)", () => {
    const frames = [
      createFrame("row2-right", 500, 420),
      createFrame("row1-right", 500, 20),
      createFrame("row2-left", 0, 400),
      // slightly lower than its row neighbour, but still in the same row
      createFrame("row1-left", 0, 60),
    ];

    expect(sortFramesInReadingOrder(frames).map((frame) => frame.id)).toEqual([
      "row1-left",
      "row1-right",
      "row2-left",
      "row2-right",
    ]);
  });
});

describe("presentation mode", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([
      createFrame("slide-2", 500, 0),
      createFrame("slide-1", 0, 0),
      createFrame("slide-3", 1000, 0),
    ]);
  });

  const startPresentation = () =>
    act(() => {
      API.executeAction(actionTogglePresentation);
    });

  it("starts on the first slide in view mode, locked to the frame", () => {
    startPresentation();

    expect(h.state.presentation).toEqual({ frameId: "slide-1" });
    expect(h.state.viewModeEnabled).toBe(true);
    expect(h.state.frameRendering.name).toBe(false);
    expect(h.state.frameRendering.outline).toBe(false);
    expect(h.state.scrollConstraints).toMatchObject({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      lockScroll: true,
      lockZoom: true,
    });
    expect(screen.getByTestId("presentation-counter").textContent).toBe(
      "1 / 3",
    );
  });

  it("navigates between slides with the keyboard", () => {
    startPresentation();

    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(h.state.presentation?.frameId).toBe("slide-2");

    Keyboard.keyPress(KEYS.SPACE);
    expect(h.state.presentation?.frameId).toBe("slide-3");

    // stays on the last slide
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    expect(h.state.presentation?.frameId).toBe("slide-3");

    Keyboard.keyPress(KEYS.ARROW_LEFT);
    expect(h.state.presentation?.frameId).toBe("slide-2");

    Keyboard.keyPress(KEYS.END);
    expect(h.state.presentation?.frameId).toBe("slide-3");

    Keyboard.keyPress(KEYS.HOME);
    expect(h.state.presentation?.frameId).toBe("slide-1");
  });

  it("navigates with the on-screen controls", () => {
    startPresentation();

    act(() => {
      screen.getByLabelText("Next slide").click();
    });
    expect(h.state.presentation?.frameId).toBe("slide-2");
    expect(screen.getByTestId("presentation-counter").textContent).toBe(
      "2 / 3",
    );

    act(() => {
      screen.getByLabelText("Previous slide").click();
    });
    expect(h.state.presentation?.frameId).toBe("slide-1");
  });

  it("restores the editor on Escape", () => {
    API.updateScene({
      appState: { scrollX: 123, scrollY: -45, zoom: { value: 0.5 as any } },
    });

    startPresentation();
    Keyboard.keyPress(KEYS.ESCAPE);

    expect(h.state.presentation).toBe(null);
    expect(h.state.viewModeEnabled).toBe(false);
    expect(h.state.scrollConstraints).toBe(null);
    expect(h.state.frameRendering.name).toBe(true);
    expect(h.state.scrollX).toBe(123);
    expect(h.state.scrollY).toBe(-45);
    expect(h.state.zoom.value).toBe(0.5);
    expect(screen.queryByTestId("presentation-counter")).toBe(null);
  });

  it("starts from the selected frame", () => {
    API.setAppState({ selectedElementIds: { "slide-2": true } });

    act(() => {
      API.executeAction(actionPresentFromFrame);
    });

    expect(h.state.presentation?.frameId).toBe("slide-2");
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("moves on when the current frame gets deleted", () => {
    startPresentation();

    act(() => {
      API.updateScene({
        elements: h.elements.map((element) =>
          element.id === "slide-1"
            ? newElementWith(element, { isDeleted: true })
            : element,
        ),
      });
    });

    expect(h.state.presentation?.frameId).toBe("slide-2");
  });

  it("shows a hint instead of starting when there are no frames", () => {
    API.setElements([API.createElement({ type: "rectangle" })]);

    startPresentation();

    expect(h.state.presentation).toBe(null);
    expect(h.state.toast?.message).toBe(
      "Add frames to present them as slides.",
    );
  });
});
