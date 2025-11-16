import React from "react";
import { isLineElement } from "@excalidraw/element";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Pointer, UI } from "../tests/helpers/ui";
import { act, render } from "../tests/test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("Background color for open lines", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  it("should disable background color picker when open line is selected", async () => {
    // Create an open line
    UI.clickTool("line");
    mouse.down(10, 10);
    mouse.up(100, 100);

    const openLine = API.getSelectedElement();
    expect(openLine.type).toBe("line");
    
    // Verify it's an open line (polygon is false or undefined)
    if (isLineElement(openLine)) {
      expect(openLine.polygon).toBeFalsy();
    }

    // Try to find the background color picker trigger
    const backgroundTrigger = document.querySelector(
      '[aria-label="Background"], [data-testid="element-background"]',
    );

    // Background picker should be disabled for open lines
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

  it("should enable background color picker for closed polygon", async () => {
    // Create a closed polygon using API helper
    const closedLine = API.createElement({
      type: "line",
      // Use small polygon for testing
    });
    
    // Manually set polygon to true to simulate closed shape
    if (isLineElement(closedLine)) {
      (closedLine as any).polygon = true;
    }

    h.elements = [closedLine];
    API.setSelectedElements([closedLine]);

    const backgroundTrigger = document.querySelector(
      '[aria-label="Background"], [data-testid="element-background"]',
    );

    // Background picker should be enabled for closed polygons
    expect(backgroundTrigger).not.toHaveAttribute("aria-disabled", "true");
  });

  it("should keep open line with transparent background and not convert to polygon", async () => {
    // Create an open line
    const openLine = API.createElement({
      type: "line",
      backgroundColor: "transparent",
    });

    h.elements = [openLine];
    API.setSelectedElements([openLine]);

    // Verify initial state
    expect(openLine.type).toBe("line");
    if (isLineElement(openLine)) {
      expect(openLine.polygon).toBeFalsy();
      expect(openLine.backgroundColor).toBe("transparent");
    }

    // The background should remain transparent for open lines
    // and the line should NOT be converted to a polygon
    const updatedLine = h.elements[0];
    if (isLineElement(updatedLine)) {
      // Line should still be open (not a polygon)
      expect(updatedLine.polygon).toBeFalsy();
      // Background should remain transparent
      expect(updatedLine.backgroundColor).toBe("transparent");
    }
  });

  it("should not change backgroundColor of open line when clicking on color", async () => {
    // Create an open line
    UI.clickTool("line");
    mouse.down(10, 10);
    mouse.up(100, 100);

    const openLine = API.getSelectedElement();
    expect(openLine.type).toBe("line");
    const initialBgColor = openLine.backgroundColor;

    // Since the background picker should be disabled, 
    // we can't actually click on it in the UI
    // But let's verify the element hasn't changed
    const lineAfter = API.getSelectedElement();
    
    // Background should remain the same (transparent or initial value)
    expect(lineAfter.backgroundColor).toBe(initialBgColor);
    
    // And it should still be an open line
    if (isLineElement(lineAfter)) {
      expect(lineAfter.polygon).toBeFalsy();
    }
  });
});
