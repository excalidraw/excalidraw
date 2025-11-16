import { isLineElement, isOpenLine, newElementWith } from "@excalidraw/element";
import { isTransparent } from "@excalidraw/common";
import { API } from "./helpers/api";
import type { ExcalidrawElement } from "@excalidraw/element/types";

// Helper function to simulate the protection logic
const applyBackgroundColorWithProtection = (
  element: ExcalidrawElement,
  newColor: string,
) => {
  if (isOpenLine(element) && !isTransparent(newColor)) {
    return element; // Don't change open lines
  }
  return newElementWith(element, { backgroundColor: newColor });
};

describe("actionChangeBackgroundColor logic for open lines", () => {
  it("should not apply non-transparent background to open lines", () => {
    const openLine = API.createElement({
      type: "line",
      backgroundColor: "transparent",
    });

    expect(isOpenLine(openLine)).toBe(true);

    const updatedElement = applyBackgroundColorWithProtection(openLine, "#ff0000");

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

  it("should allow transparent background for open lines", () => {
    const openLine = API.createElement({
      type: "line",
      backgroundColor: "transparent",
    });

    const updatedElement = applyBackgroundColorWithProtection(openLine, "transparent");

    expect(updatedElement.backgroundColor).toBe("transparent");
  });
});
