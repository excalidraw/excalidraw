import {
  ExcalidrawElement,
  ExcalidrawArrowElement,
  ExcalidrawLineElement
} from "./types";
import { rotate } from "../math";

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
// We can't just always normalize it since we need to remember the fact that an arrow
// is pointing left or right.
export function getElementAbsoluteCoords(element: ExcalidrawElement) {
  return [
    element.width >= 0 ? element.x : element.x + element.width, // x1
    element.height >= 0 ? element.y : element.y + element.height, // y1
    element.width >= 0 ? element.x + element.width : element.x, // x2
    element.height >= 0 ? element.y + element.height : element.y // y2
  ];
}

export function getDiamondPoints(element: ExcalidrawElement) {
  // Here we add +1 to avoid these numbers to be 0
  // otherwise rough.js will throw an error complaining about it
  const topX = Math.floor(element.width / 2) + 1;
  const topY = 0;
  const rightX = element.width;
  const rightY = Math.floor(element.height / 2) + 1;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = topY;
  const leftY = rightY;

  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
}

export enum Quadrant {
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight
}

export function getArrowPoints(element: ExcalidrawArrowElement) {
  let x1, y1, x2, y2;
  const quadrant = getQuadrant(element);
  switch (quadrant) {
    case Quadrant.TopLeft:
      x1 = element.width;
      y1 = element.height;
      x2 = 0;
      y2 = 0;
      break;
    case Quadrant.TopRight:
      x1 = 0;
      y1 = element.height;
      x2 = element.width;
      y2 = 0;
      break;
    case Quadrant.BottomLeft:
      x1 = element.width;
      y1 = 0;
      x2 = 0;
      y2 = element.height;
      break;
    case Quadrant.BottomRight:
      x1 = 0;
      y1 = 0;
      x2 = element.width;
      y2 = element.height;
      break;
  }

  const size = 30; // pixels
  const distance = Math.hypot(x2 - x1, y2 - y1);
  // Scale down the arrow until we hit a certain size so that it doesn't look weird
  const minSize = Math.min(size, distance / 2);
  const xs = x2 - ((x2 - x1) / distance) * minSize;
  const ys = y2 - ((y2 - y1) / distance) * minSize;

  const angle = 20; // degrees
  const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
  const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);

  return [x1, y1, x2, y2, x3, y3, x4, y4];
}

export function getLinePoints(element: ExcalidrawLineElement) {
  let x1, y1, x2, y2;
  const quadrant = getQuadrant(element);
  switch (quadrant) {
    case Quadrant.TopLeft:
      x1 = element.width;
      y1 = element.height;
      x2 = 0;
      y2 = 0;
      break;
    case Quadrant.TopRight:
      x1 = 0;
      y1 = element.height;
      x2 = element.width;
      y2 = 0;
      break;
    case Quadrant.BottomLeft:
      x1 = element.width;
      y1 = 0;
      x2 = 0;
      y2 = element.height;
      break;
    case Quadrant.BottomRight:
      x1 = 0;
      y1 = 0;
      x2 = element.width;
      y2 = element.height;
      break;
  }

  return [x1, y1, x2, y2];
}

// From the current arrow angle returns the quadrant that the end of it is
// pointing towards
export function getQuadrant(
  element: ExcalidrawArrowElement | ExcalidrawLineElement
): Quadrant {
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
