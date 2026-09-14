import React from "react";
import { fireEvent } from "@testing-library/react";

import { POINTER_BUTTON } from "@excalidraw/common";

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

  it("pans once the pointer travels past the drag threshold, with no context menu", () => {
    fireEvent.pointerDown(canvas(), at(100, 100));
    const start = getViewport();

    // within the threshold it is still a click
    fireEvent.pointerMove(canvas(), at(105, 103));
    expect(getViewport()).toEqual(start);

    // past it the pan engages, and moves from here on
    fireEvent.pointerMove(canvas(), at(130, 120));
    expect(getViewport()).toEqual(start);
    fireEvent.pointerMove(canvas(), at(140, 135));
    expect(getViewport()).toEqual({
      ...start,
      scrollX: start.scrollX + 10 / start.zoom,
      scrollY: start.scrollY + 15 / start.zoom,
    });

    fireEvent.pointerUp(window, { ...at(140, 135), buttons: 0 });
    expect(h.state.contextMenu).toBe(null);

    // the platform's own contextmenu for this press (Windows fires it on
    // mouseup) is not a new click...
    fireEvent.contextMenu(canvas(), at(140, 135));
    expect(h.state.contextMenu).toBe(null);
    // ...but only that one
    fireEvent.contextMenu(canvas(), at(140, 135));
    expect(h.state.contextMenu).not.toBe(null);
  });

  it("opens the context menu on release when not dragged (contextmenu after mouseup)", () => {
    fireEvent.pointerDown(canvas(), at(100, 100));
    fireEvent.pointerMove(canvas(), at(104, 102));
    expect(h.state.contextMenu).toBe(null);

    fireEvent.pointerUp(window, { ...at(104, 102), buttons: 0 });
    const menu = h.state.contextMenu;
    expect(menu).not.toBe(null);
    expect(menu!.left).toBe(104 - h.state.offsetLeft);
    expect(menu!.top).toBe(102 - h.state.offsetTop);

    // the platform's contextmenu for the same press does not open it again
    fireEvent.contextMenu(canvas(), at(104, 102));
    expect(h.state.contextMenu).toBe(menu);
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
    fireEvent.pointerUp(window, { ...at(30, 30), buttons: 0 });

    expect(h.state.contextMenu).not.toBe(null);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);
  });

  it("leaves a menu-less editor menu-less while still panning", async () => {
    await render(<Excalidraw interaction={false} />);
    fireEvent.pointerDown(canvas(), at(100, 100));
    fireEvent.pointerUp(window, { ...at(100, 100), buttons: 0 });
    expect(h.state.contextMenu).toBe(null);
  });
});
