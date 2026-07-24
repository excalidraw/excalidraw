import React from "react";

import { CODES, STROKE_WIDTH } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

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

    API.setSelectedElements([h.elements[1]] as NonDeletedExcalidrawElement[]);

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.C);
    });
    const secondRect = JSON.parse(copiedStyles)[0];
    expect(secondRect.id).toBe(h.elements[1].id);

    mouse.reset();
    // Paste styles to first rectangle
    API.setSelectedElements([h.elements[0]] as NonDeletedExcalidrawElement[]);
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

  it("shows gradient controls when fill style is set to gradient, and hides them otherwise", async () => {
    UI.createElement("rectangle", { x: 0, y: 0, width: 100, height: 100 });
    togglePopover("Background");
    UI.clickOnTestId("color-blue");

    expect(screen.queryByTestId("gradient-angle")).toBeNull();

    fireEvent.click(screen.getByTestId("fill-gradient"));

    expect(screen.getByTestId("gradient-angle")).not.toBeNull();
  });

  it("seeds gradient defaults when switching fill style to gradient", async () => {
    UI.createElement("rectangle", { x: 0, y: 0, width: 100, height: 100 });
    togglePopover("Background");
    UI.clickOnTestId("color-blue");

    const rect = API.getSelectedElement();
    expect(rect.gradient).toBeNull();

    fireEvent.click(screen.getByTestId("fill-gradient"));

    const updatedRect = API.getSelectedElement();
    // color2 should default to a color visibly different from the background
    // (blue here), not the background color itself, otherwise the gradient
    // is invisible.
    expect(updatedRect.gradient).toEqual({
      color2: "#ffffff",
      angle: 0,
    });
    expect(updatedRect.gradient?.color2).not.toEqual(rect.backgroundColor);
  });

  it("seeds gradient defaults when selecting gradient with no element selected, before drawing", async () => {
    UI.clickTool("rectangle");
    togglePopover("Background");
    UI.clickOnTestId("color-blue");

    expect(screen.queryByTestId("fill-gradient")).not.toBeNull();
    fireEvent.click(screen.getByTestId("fill-gradient"));

    mouse.down(0, 0);
    mouse.up(100, 100);

    const rect = API.getSelectedElement();
    expect(rect.fillStyle).toBe("gradient");
    expect(rect.gradient).not.toBeNull();
    expect(rect.gradient?.color2).not.toEqual(rect.backgroundColor);
  });

  it("preserves a previously chosen gradient when switching fill style away and back", async () => {
    UI.createElement("rectangle", { x: 0, y: 0, width: 100, height: 100 });
    togglePopover("Background");
    UI.clickOnTestId("color-blue");

    fireEvent.click(screen.getByTestId("fill-gradient"));

    // Change the gradient angle away from the default seeded value.
    fireEvent.change(screen.getByTestId("gradient-angle"), {
      target: { value: "90" },
    });

    const gradientedRect = API.getSelectedElement();
    expect(gradientedRect.gradient?.angle).toBe(90);

    // Switch away from gradient, then back to it.
    fireEvent.click(screen.getByTestId("fill-solid"));
    fireEvent.click(screen.getByTestId("fill-gradient"));

    const finalRect = API.getSelectedElement();
    expect(finalRect.gradient).toEqual(gradientedRect.gradient);
  });

  it("does not offer the gradient fill option for line elements", async () => {
    UI.createElement("line", { x: 0, y: 0, width: 100, height: 100 });
    togglePopover("Background");
    UI.clickOnTestId("color-blue");

    expect(screen.queryByTestId("fill-gradient")).toBeNull();
    expect(screen.queryByTestId("gradient-angle")).toBeNull();
  });

  it("opens the gradient end color picker without clobbering the gradient", async () => {
    UI.createElement("rectangle", { x: 0, y: 0, width: 100, height: 100 });
    togglePopover("Background");
    UI.clickOnTestId("color-blue");
    togglePopover("Background"); // close it, so only the gradient-end popover can be open below

    fireEvent.click(screen.getByTestId("fill-gradient"));

    const seededGradient = API.getSelectedElement().gradient;

    const trigger = screen.getByLabelText("Gradient end color");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    togglePopover("Gradient end color");

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Hex code")).not.toBeNull();
    expect(API.getSelectedElement().gradient).toEqual(seededGradient);
  });
});
