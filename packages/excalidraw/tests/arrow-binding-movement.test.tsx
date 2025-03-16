import React from "react";
import { pointFrom } from "@excalidraw/math";

import { Excalidraw } from "../index";
import { KEYS } from "../keys";

import { UI } from "./helpers/ui";
import { Keyboard, Pointer } from "./helpers/ui";
import { render } from "./test-utils";

import type { ExcalidrawElement } from "../element/types";

const mouse = new Pointer("mouse");

describe("arrow binding movement", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("should maintain arrow position when bound shape is moved", () => {
    // Create a rectangle
    const rect = UI.createElement("rectangle", {
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

    // Store original arrow position relative to rectangle
    const originalArrowStart = [...arrow.points[0]];
    const originalArrowEnd = [...arrow.points[1]];
    const originalRelativeEndX = originalArrowEnd[0] - (rect.x - arrow.x);
    const originalRelativeEndY = originalArrowEnd[1] - (rect.y - arrow.y);

    // Move the rectangle
    UI.clickTool("selection");
    mouse.clickOn(rect);
    mouse.downAt(rect.x + 50, rect.y + 50);
    mouse.moveTo(rect.x + 100, rect.y + 50); // Move 50px to the right
    mouse.up();

    // The arrow should maintain its relative position to the rectangle
    // This means the start point should still be bound to the rectangle edge
    // And the end point should maintain the same relative distance

    // Check if the arrow is still correctly positioned
    expect(arrow.points[0]).toEqual(originalArrowStart); // Start point remains at origin

    // Calculate the expected relative position after rectangle movement
    const movedRect = window.h.elements.find(
      (el: ExcalidrawElement) => el.id === rect.id,
    )!;
    const expectedRelativeEndX = originalRelativeEndX + (movedRect.x - rect.x);
    const expectedRelativeEndY = originalRelativeEndY;

    // Either the end point should maintain its absolute position
    // or it should maintain its relative position to the rectangle
    const endPoint = arrow.points[1];
    const endPointMaintainsRelativePosition =
      Math.abs(endPoint[0] - expectedRelativeEndX) < 1 &&
      Math.abs(endPoint[1] - expectedRelativeEndY) < 1;

    const endPointMaintainsAbsolutePosition =
      Math.abs(endPoint[0] - originalArrowEnd[0]) < 1 &&
      Math.abs(endPoint[1] - originalArrowEnd[1]) < 1;

    expect(
      endPointMaintainsRelativePosition || endPointMaintainsAbsolutePosition,
    ).toBe(true);
  });

  it("should restore arrow shape after undo", () => {
    // Create a rectangle
    const rect = UI.createElement("rectangle", {
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

    // Move the rectangle
    UI.clickTool("selection");
    mouse.clickOn(rect);
    mouse.downAt(rect.x + 50, rect.y + 50);
    mouse.moveTo(rect.x + 100, rect.y + 50); // Move 50px to the right
    mouse.up();

    // Perform undo
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.Z);
    });

    // Verify arrow points are exactly the same after undo
    expect(arrow.points).toEqual(originalPoints);
  });
});
