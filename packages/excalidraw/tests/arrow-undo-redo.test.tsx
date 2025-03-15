import React from "react";

import { pointFrom } from "@excalidraw/math";

import { Excalidraw } from "../index";

import { KEYS } from "../keys";

import { UI } from "./helpers/ui";
import { Keyboard, Pointer } from "./helpers/ui";
import { render } from "./test-utils";

const mouse = new Pointer("mouse");

describe("arrow undo/redo", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should maintain arrow shape after undo/redo", () => {
    // Create a rectangle
    UI.createElement("rectangle", {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });

    // Create an arrow starting from rectangle border
    const arrow = UI.createElement("arrow", {
      x: 150,
      y: 100,
      width: 100,
      height: 50,
      points: [pointFrom(0, 0), pointFrom(100, 50)],
    });

    // Store original arrow points
    const originalPoints = [...arrow.points];

    // Perform undo
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    // Perform redo
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    // Verify arrow points are exactly the same after redo
    expect(arrow.points).toEqual(originalPoints);

    // Verify that it can restore when the arrow is rerouted
    mouse.downAt(100, 100);
    mouse.moveTo(103, 100);
    mouse.moveTo(100, 100);
    mouse.up();

    Keyboard.undo();

    expect(arrow.points).toEqual(originalPoints);
  });
});
