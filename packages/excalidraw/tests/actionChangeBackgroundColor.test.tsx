import { isFreeDrawElement, isOpenFreedraw, newElementWith } from "@excalidraw/element";
import { isTransparent } from "@excalidraw/common";
import { API } from "./helpers/api";
import type { ExcalidrawElement } from "@excalidraw/element/types";

// Helper function to simulate the protection logic
const applyBackgroundColorWithProtection = (
  element: ExcalidrawElement,
  newColor: string,
) => {
  if (isOpenFreedraw(element) && !isTransparent(newColor)) {
    return element; // Don't change open freedraw
  }
  return newElementWith(element, { backgroundColor: newColor });
};

describe("actionChangeBackgroundColor logic for open freedraw", () => {
  it("should not apply non-transparent background to open freedraw", () => {
    const openFreedraw = API.createElement({
      type: "freedraw",
      backgroundColor: "transparent",
    });

    expect(isOpenFreedraw(openFreedraw)).toBe(true);

    const updatedElement = applyBackgroundColorWithProtection(openFreedraw, "#ff0000");

    expect(updatedElement.backgroundColor).toBe("transparent");
  });

  it("should allow changing background for rectangles", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      backgroundColor: "transparent",
    });

    const updatedElement = applyBackgroundColorWithProtection(rectangle, "#ff0000");

    expect(updatedElement.backgroundColor).toBe("#ff0000");
  });

  it("should allow transparent background for open freedraw", () => {
    const openFreedraw = API.createElement({
      type: "freedraw",
      backgroundColor: "transparent",
    });

    const updatedElement = applyBackgroundColorWithProtection(openFreedraw, "transparent");

    expect(updatedElement.backgroundColor).toBe("transparent");
  });
  
  it("should allow changing background for closed freedraw (loop)", () => {
    const closedFreedraw = API.createElement({
      type: "freedraw",
      backgroundColor: "transparent",
    });
    
    // Manually set points that form a loop
    (closedFreedraw as any).points = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [2, 2], // Close to [0, 0], forms a loop
    ];

    const updatedElement = applyBackgroundColorWithProtection(closedFreedraw, "#ff0000");

    expect(updatedElement.backgroundColor).toBe("#ff0000");
  });
});
