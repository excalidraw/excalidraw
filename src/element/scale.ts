import { isTextElement } from "./typeChecks";
import { redrawTextBoundingBox } from "./textElement";
import { ExcalidrawElement } from "./types";

export function getScaledElement(
  element: ExcalidrawElement,
  scale: number,
): ExcalidrawElement {
  switch (element.type) {
    case "selection": {
      return element;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line": {
      const scaledElement = { ...element };
      scaledElement.x *= scale;
      scaledElement.y *= scale;
      scaledElement.width *= scale;
      scaledElement.height *= scale;
      scaledElement.strokeWidth *= scale;
      return scaledElement;
    }
    case "arrow": {
      const scaledElement = { ...element };
      scaledElement.x *= scale;
      scaledElement.y *= scale;
      scaledElement.width *= scale;
      scaledElement.height *= scale;
      scaledElement.strokeWidth *= scale;
      scaledElement.points = scaledElement.points.map(([x, y]) => [
        x * scale,
        y * scale,
      ]);
      return scaledElement;
    }
    default: {
      if (isTextElement(element)) {
        const scaledElement = { ...element };
        scaledElement.x *= scale;
        scaledElement.y *= scale;
        const fontSize = parseFloat(scaledElement.font);
        scaledElement.font = `${fontSize * scale}px ${
          scaledElement.font.split("px ")[1]
        }`;
        redrawTextBoundingBox(scaledElement);
        return scaledElement;
      }
      throw new Error("Unimplemented type " + element.type);
    }
  }
}
