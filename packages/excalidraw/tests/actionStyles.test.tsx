import React from "react";

import { CODES, COLOR_PALETTE } from "@excalidraw/common";

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

// Minimal ResizeObserver stub required by Radix UI popovers in jsdom.
const stubResizeObserver = () => {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
};

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
    expect(firstRect.strokeWidth).toBe(2); // Bold: 2
    expect(firstRect.strokeStyle).toBe("dotted");
    expect(firstRect.roughness).toBe(2); // Cartoonist: 2
    expect(firstRect.opacity).toBe(60);
  });

  describe("modifier-key style selection (Ctrl/Cmd held)", () => {
    it("Ctrl+S opens stroke color picker and color click applies to selection only", async () => {
      stubResizeObserver();

      UI.clickTool("rectangle");
      mouse.down(10, 10);
      mouse.up(20, 20);
      API.setSelectedElements([h.elements[0]]);

      const defaultStroke = h.state.currentItemStrokeColor;

      // Pressing "Control" sets isModifierKeyHeld; pressing "s" with Ctrl
      // should open the stroke picker instead of triggering the save action.
      await act(async () => {
        fireEvent.keyDown(document, { key: "Control", ctrlKey: true });
        fireEvent.keyDown(document, { key: "s", ctrlKey: true });
      });

      expect(h.state.openPopup).toBe("elementStroke");

      // Pick a colour — must update the element but NOT the tool default.
      UI.clickOnTestId("color-red");

      expect(h.elements[0].strokeColor).toBe(
        COLOR_PALETTE.red[4], // "#e03131"
      );
      expect(h.state.currentItemStrokeColor).toBe(defaultStroke);

      fireEvent.keyUp(document, { key: "Control" });
    });

    it("keyboard hotkey inside open picker with Ctrl held applies to selection only", async () => {
      stubResizeObserver();

      UI.clickTool("rectangle");
      mouse.down(10, 10);
      mouse.up(20, 20);
      API.setSelectedElements([h.elements[0]]);

      const defaultStroke = h.state.currentItemStrokeColor;

      // Open the picker normally (no modifier).
      await act(async () => {
        fireEvent.keyDown(document, { key: "s" });
      });

      expect(h.state.openPopup).toBe("elementStroke");

      // Now hold Ctrl and press a colour hotkey inside the picker.
      // "e" is the 3rd hotkey → maps to "gray" in the stroke palette.
      const pickerContent = document.querySelector(".color-picker-content");
      expect(pickerContent).not.toBeNull();

      await act(async () => {
        fireEvent.keyDown(document, { key: "Control", ctrlKey: true });
        fireEvent.keyDown(pickerContent!, { key: "e", ctrlKey: true });
      });

      // Element colour should have changed to gray…
      expect(h.elements[0].strokeColor).toBe(COLOR_PALETTE.gray[4]);
      // …but the tool default must remain unchanged.
      expect(h.state.currentItemStrokeColor).toBe(defaultStroke);

      fireEvent.keyUp(document, { key: "Control" });
    });
  });
});
