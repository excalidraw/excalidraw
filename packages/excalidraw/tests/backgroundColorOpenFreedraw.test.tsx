import React from "react";
import { isFreeDrawElement, isOpenFreedraw } from "@excalidraw/element";
import { isPathALoop } from "@excalidraw/element/utils";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("Background color for open freedraw", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("should disable background color picker when open freedraw is selected", async () => {
    // Create an open freedraw using API
    const openFreedraw = API.createElement({
      type: "freedraw",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });

    h.elements = [openFreedraw];
    API.setSelectedElements([openFreedraw]);

    await act(async () => {
      h.setState({});
    });

    expect(openFreedraw.type).toBe("freedraw");
    
    // Verify it's an open freedraw (isPathALoop returns false)
    if (isFreeDrawElement(openFreedraw)) {
      expect(isPathALoop(openFreedraw.points)).toBe(false);
    }

    // Try to find the background color picker trigger
    const backgroundTrigger = document.querySelector(
      '[aria-label="Background"], [data-testid="element-background"]',
    );

    // Background picker should be disabled for open freedraw
    expect(backgroundTrigger).toHaveAttribute("aria-disabled", "true");
  });

  it("should enable background color picker for rectangle", async () => {
    // Create a rectangle
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 100);

    const rectangle = API.getSelectedElement();
    expect(rectangle.type).toBe("rectangle");

    // Background picker should be enabled for rectangles
    const backgroundTrigger = document.querySelector(
      '[aria-label="Background"], [data-testid="element-background"]',
    );

    expect(backgroundTrigger).not.toHaveAttribute("aria-disabled", "true");
  });

  it("should enable background color picker for closed freedraw (loop)", async () => {
    // Create a closed freedraw using API helper
    const closedFreedraw = API.createElement({ 
      type: "freedraw",
    });
    
    // Manually set points that form a loop (first and last very close)
    (closedFreedraw as any).points = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [2, 2], // Close to [0, 0], forms a loop
    ];

    h.elements = [closedFreedraw];
    API.setSelectedElements([closedFreedraw]);

    const backgroundTrigger = document.querySelector(
      '[aria-label="Background"], [data-testid="element-background"]',
    );

    // Background picker should be enabled for closed freedraw
    expect(backgroundTrigger).not.toHaveAttribute("aria-disabled", "true");
  });
});
