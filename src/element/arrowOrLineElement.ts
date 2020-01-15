import { ExcalidrawArrowElement, ExcalidrawLineElement } from "./types";
import { getQuadrant, Quadrant } from "./bounds";

export function normalizeArrowOrLineElement(
  element: ExcalidrawArrowElement | ExcalidrawLineElement,
  { x1, y1 }: { x1: number; y1: number },
  { x2, y2 }: { x2: number; y2: number }
) {
  element.angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const quadrant = getQuadrant(element);
  switch (quadrant) {
    case Quadrant.TopLeft:
      element.x = x2;
      element.y = y2;
      break;
    case Quadrant.TopRight:
      element.x = x1;
      element.y = y2;
      break;
    case Quadrant.BottomLeft:
      element.x = x2;
      element.y = y1;
      break;
    case Quadrant.BottomRight:
      element.x = x1;
      element.y = y1;
  }
  element.width = Math.abs(element.width);
  element.height = Math.abs(element.height);
}

// From a denormalized arrow/line (where "x" and "y" point to the start of the line and
// not necessarily the top-left corner of the bounding box) get the coordinates
// of the top-left spot
export function getAbsoluteArrowOrLinePointsCoords(
  element: ExcalidrawArrowElement | ExcalidrawLineElement
) {
  const quadrant = getQuadrant(element);
  switch (quadrant) {
    case Quadrant.TopLeft:
      return {
        x1: element.x + element.width,
        y1: element.y + element.height,
        x2: element.x,
        y2: element.y
      };
    case Quadrant.TopRight:
      return {
        x1: element.x,
        y1: element.y + element.height,
        x2: element.x + element.width,
        y2: element.y
      };
    case Quadrant.BottomLeft:
      return {
        x1: element.x + element.width,
        y1: element.y,
        x2: element.x,
        y2: element.y + element.height
      };
    case Quadrant.BottomRight:
      return {
        x1: element.x,
        y1: element.y,
        x2: element.x + element.width,
        y2: element.y + element.height
      };
  }
}
