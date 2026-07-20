import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Returns the area of the given element, or null if the element type is not
 * supported.
 */
export const getShapeArea = (element: ExcalidrawElement): number | null => {
  const { type, width, height } = element;

  switch (type) {
    case "rectangle":
      return width * height;
    case "ellipse":
      return Math.PI * (width / 2) * (height / 2);
    case "diamond":
      return (width * height) / 2;
    default:
      return null;
  }
};

/**
 * Returns the perimeter of the given element, or null if the element type is
 * not supported.
 *
 * The ellipse perimeter uses Ramanujan's approximation.
 */
export const getShapePerimeter = (
  element: ExcalidrawElement,
): number | null => {
  const { type, width, height } = element;

  switch (type) {
    case "rectangle":
      return 2 * (width + height);
    case "ellipse": {
      const a = width / 2;
      const b = height / 2;
      return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    }
    case "diamond":
      return 4 * Math.hypot(width / 2, height / 2);
    default:
      return null;
  }
};
