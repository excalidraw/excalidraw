import { ExcalidrawArrowElement } from "./types";

export enum Quadrant {
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight
}

// From the current arrow angle returns the quadrant that the end of it is
// pointing towards
export function getArrowQuadrant(element: ExcalidrawArrowElement): Quadrant {
  //   Angle by quadrant
  //
  //
  //            |
  //  < -90     | <0 && >= -90
  //            |
  //  - - - - - - - - - - - - -
  //            |
  //   > 90     |  < 90
  //            |
  //            |
  if (element.angle > 90) {
    return Quadrant.BottomLeft;
  } else if (element.angle < 0 && element.angle >= -90) {
    return Quadrant.TopRight;
  } else if (element.angle < -90) {
    return Quadrant.TopLeft;
  } else {
    return Quadrant.BottomRight;
  }
}

export function normalizeArrowElement(
  element: ExcalidrawArrowElement,
  { x1, y1 }: { x1: number; y1: number },
  { x2, y2 }: { x2: number; y2: number }
) {
  element.angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const quadrant = getArrowQuadrant(element);
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

export function getAbsoluteArrowPointsCoords(element: ExcalidrawArrowElement) {
  const quadrant = getArrowQuadrant(element);
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
