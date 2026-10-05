import React from "react";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import {
  CURSOR_TYPE,
  POINTER_BUTTON,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { GlobalTestState, render } from "./test-utils";

const { h } = window;

const secondaryButton = {
  pointerId: 1,
  pointerType: "mouse",
  // `button` identifies the pressed button, `buttons` the held-down set
  button: POINTER_BUTTON.SECONDARY,
  buttons: 2,
};

const at = (clientX: number, clientY: number) => ({
  ...secondaryButton,
  clientX,
  clientY,
});

const getViewport = () => ({
  scrollX: h.state.scrollX,
  scrollY: h.state.scrollY,
  zoom: h.state.zoom.value,
});

const canvas = () => GlobalTestState.interactiveCanvas;

describe("secondary-button pan", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it.each([false, true])(
    "pans past five pixels with no context menu (viewModeEnabled=%s)",
    (viewModeEnabled) => {
      API.setAppState({ viewModeEnabled });
      fireEvent.pointerDown(canvas(), at(100, 100));
      const start = getViewport();

      // at the five-pixel threshold it is still a click
      fireEvent.pointerMove(canvas(), at(103, 104));
      expect(getViewport()).toEqual(start);
      expect(canvas().style.cursor).not.toBe(CURSOR_TYPE.GRABBING);

      // past it the pan engages, and moves from here on
      fireEvent.pointerMove(canvas(), at(106, 100));
      expect(getViewport()).toEqual(start);
      expect(canvas().style.cursor).toBe(CURSOR_TYPE.GRABBING);
      fireEvent.pointerMove(canvas(), at(108, 103));
      expect(getViewport()).toEqual({
        ...start,
        scrollX: start.scrollX + 2 / start.zoom,
        scrollY: start.scrollY + 3 / start.zoom,
      });

      fireEvent.pointerUp(window, { ...at(108, 103), buttons: 0 });
      expect(h.state.contextMenu).toBe(null);

      // the platform's own contextmenu for this press (Windows fires it on
      // mouseup) is not a new click...
      fireEvent.contextMenu(canvas(), at(108, 103));
      expect(h.state.contextMenu).toBe(null);
      // ...but only that one
      fireEvent.contextMenu(canvas(), at(108, 103));
      expect(h.state.contextMenu).not.toBe(null);
    },
  );

  it("lets the platform's contextmenu after mouseup open the menu, as always", () => {
    fireEvent.pointerDown(canvas(), at(100, 100));
    fireEvent.pointerMove(canvas(), at(104, 102));
    expect(h.state.contextMenu).toBe(null);

    // Windows fires contextmenu after mouseup: nothing is open at release,
    // so the event lands on the canvas and opens the menu, as before
    fireEvent.pointerUp(window, { ...at(104, 102), buttons: 0 });
    expect(h.state.contextMenu).toBe(null);
    fireEvent.contextMenu(canvas(), at(104, 102));
    const menu = h.state.contextMenu;
    expect(menu).not.toBe(null);
    expect(menu!.left).toBe(104 - h.state.offsetLeft);
    expect(menu!.top).toBe(102 - h.state.offsetTop);
  });

  it.each([false, true])(
    "pauses pointer broadcasts until pan release (viewModeEnabled=%s)",
    (viewModeEnabled) => {
      const onPointerUpdate = vi.fn();
      GlobalTestState.renderResult.rerender(
        <Excalidraw onPointerUpdate={onPointerUpdate} />,
      );
      API.setAppState({ viewModeEnabled });
      fireEvent.pointerDown(canvas(), at(100, 100));
      fireEvent.pointerMove(canvas(), at(103, 104));
      fireEvent.pointerMove(canvas(), at(106, 100));
      fireEvent.pointerMove(canvas(), at(140, 135));
      expect(onPointerUpdate).not.toHaveBeenCalled();

      // The release can be beyond the last delivered pointer move.
      const released = { ...at(150, 145), buttons: 0 };
      fireEvent.pointerUp(canvas(), released);

      expect(onPointerUpdate).toHaveBeenCalledTimes(1);
      expect(onPointerUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pointer: {
            ...viewportCoordsToSceneCoords(released, h.state),
            tool: "pointer",
          },
          button: "up",
        }),
      );

      const hovered = { ...released, clientX: 160, clientY: 155 };
      fireEvent.pointerMove(canvas(), hovered);
      expect(onPointerUpdate).toHaveBeenCalledTimes(2);
      expect(onPointerUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pointer: {
            ...viewportCoordsToSceneCoords(hovered, h.state),
            tool: "pointer",
          },
          button: "up",
        }),
      );
    },
  );

  it("does not broadcast an old pan release after a new press", () => {
    const onPointerUpdate = vi.fn();
    GlobalTestState.renderResult.rerender(
      <Excalidraw onPointerUpdate={onPointerUpdate} />,
    );
    fireEvent.pointerDown(canvas(), at(100, 100));
    fireEvent.pointerMove(canvas(), at(106, 100));
    fireEvent.pointerMove(canvas(), at(140, 135));

    const nextPress = { ...at(150, 145), button: 0, buttons: 1 };
    try {
      // A new press cleans up the pan if its pointerup was missed.
      fireEvent.pointerDown(canvas(), nextPress);
      expect(onPointerUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ button: "down" }),
      );
    } finally {
      fireEvent.pointerUp(canvas(), { ...nextPress, buttons: 0 });
    }
  });

  it("opens the context menu on release when not dragged (contextmenu on mousedown)", () => {
    fireEvent.pointerDown(canvas(), at(100, 100));
    // macOS and Linux fire contextmenu with the press, before any drag
    // could be told apart from a click
    fireEvent.contextMenu(canvas(), at(100, 100));
    expect(h.state.contextMenu).toBe(null);

    fireEvent.pointerUp(window, { ...at(100, 100), buttons: 0 });
    expect(h.state.contextMenu).not.toBe(null);
  });

  it("does not open a menu for a drag on platforms that fire contextmenu on mousedown", () => {
    fireEvent.pointerDown(canvas(), at(100, 100));
    fireEvent.contextMenu(canvas(), at(100, 100));
    fireEvent.pointerMove(canvas(), at(130, 120));
    fireEvent.pointerMove(canvas(), at(150, 140));
    fireEvent.pointerUp(window, { ...at(150, 140), buttons: 0 });
    expect(h.state.contextMenu).toBe(null);

    // the menu is available again to a later, unrelated request
    fireEvent.contextMenu(canvas(), at(150, 140));
    expect(h.state.contextMenu).not.toBe(null);
  });

  it("selects the element under the pointer like a right-click does", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      // filled, so its interior hit-tests (a transparent shape only hits
      // on its stroke)
      backgroundColor: "#ffc9c9",
      fillStyle: "solid",
    });
    API.setElements([rectangle]);

    fireEvent.pointerDown(canvas(), at(30, 30));
    // contextmenu with the press: the session opens the menu on release
    fireEvent.contextMenu(canvas(), at(30, 30));
    fireEvent.pointerUp(window, { ...at(30, 30), buttons: 0 });

    expect(h.state.contextMenu).not.toBe(null);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });

  it("leaves a menu-less editor menu-less while still panning", async () => {
    await render(<Excalidraw interaction={false} />);
    fireEvent.pointerDown(canvas(), at(100, 100));
    fireEvent.contextMenu(canvas(), at(100, 100));
    fireEvent.pointerUp(window, { ...at(100, 100), buttons: 0 });
    expect(h.state.contextMenu).toBe(null);
  });
});
