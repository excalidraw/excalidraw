import React from "react";

import {
  CODES,
  COLOR_PALETTE,
  ROUNDNESS,
  STROKE_WIDTH,
} from "@excalidraw/common";

import { copiedStyles } from "../actions/actionStyles";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import {
  act,
  fireEvent,
  render,
  screen,
  togglePopover,
} from "../tests/test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    // affects node v16+
    await act(async () => {});
  });

  it("should copy & paste styles via keyboard", async () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    // Change some styles of second rectangle
    togglePopover("Stroke");
    UI.clickOnTestId("color-red");
    togglePopover("Background");
    UI.clickOnTestId("color-blue");
    // Fill style
    fireEvent.click(screen.getByTitle("Cross-hatch"));
    // Stroke width
    fireEvent.click(screen.getByTitle("Bold"));
    // Stroke style
    fireEvent.click(screen.getByTitle("Dotted"));
    // Roughness
    fireEvent.click(screen.getByTitle("Cartoonist"));
    // Opacity
    fireEvent.change(screen.getByTestId("opacity"), {
      target: { value: "60" },
    });

    mouse.reset();

    API.setSelectedElements([h.elements[1]]);

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.C);
    });
    const secondRect = JSON.parse(copiedStyles)[0];
    expect(secondRect.id).toBe(h.elements[1].id);

    mouse.reset();
    // Paste styles to first rectangle
    API.setSelectedElements([h.elements[0]]);
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.V);
    });

    const firstRect = API.getSelectedElement();
    expect(firstRect.id).toBe(h.elements[0].id);
    expect(firstRect.strokeColor).toBe("#e03131");
    expect(firstRect.backgroundColor).toBe("#a5d8ff");
    expect(firstRect.fillStyle).toBe("cross-hatch");
    expect(firstRect.strokeWidth).toBe(STROKE_WIDTH.bold);
    expect(firstRect.strokeStyle).toBe("dotted");
    expect(firstRect.roughness).toBe(2); // Cartoonist: 2
    expect(firstRect.opacity).toBe(60);
  });

  it("should show and apply roughness for sticky notes", async () => {
    const stickyNote = API.createElement({
      type: "stickynote",
      roughness: 0,
    });

    API.setElements([stickyNote]);
    API.setSelectedElements([stickyNote]);

    fireEvent.click(screen.getByTitle("Cartoonist"));

    expect(API.getSelectedElement().roughness).toBe(2);
  });

  it("should show and apply roundness for sticky notes", async () => {
    const stickyNote = API.createElement({
      type: "stickynote",
      roundness: null,
    });

    API.setElements([stickyNote]);
    API.setSelectedElements([stickyNote]);

    fireEvent.click(screen.getByTitle("Round"));

    expect(API.getSelectedElement().roundness).toEqual({
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    });
  });

  it("should hide transparent stroke color for sticky notes", async () => {
    UI.clickTool("stickynote");

    togglePopover("Stroke");

    expect(screen.queryByTestId("color-transparent")).toBeNull();
    expect(document.querySelector(".color-picker__button--hidden")).not.toBe(
      null,
    );
  });

  it("should track sticky note stroke color separately", async () => {
    API.setAppState({
      currentItemStrokeColor: COLOR_PALETTE.red[4],
      currentItemStickynoteStrokeColor: COLOR_PALETTE.black,
    });
    const stickyNote = API.createElement({
      type: "stickynote",
      strokeColor: COLOR_PALETTE.black,
    });

    API.setElements([stickyNote]);
    API.setSelectedElements([stickyNote]);

    togglePopover("Stroke");
    UI.clickOnTestId("color-blue");

    expect(API.getSelectedElement().strokeColor).toBe(COLOR_PALETTE.blue[4]);
    expect(h.state.currentItemStickynoteStrokeColor).toBe(
      COLOR_PALETTE.blue[4],
    );
    expect(h.state.currentItemStrokeColor).toBe(COLOR_PALETTE.red[4]);
  });
});
