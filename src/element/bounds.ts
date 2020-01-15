import { ExcalidrawElement, ExcalidrawArrowElement } from "./types";
import { rotate } from "../math";

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
// We can't just always normalize it since we need to remember the fact that an arrow
// is pointing left or right.
export function getElementAbsoluteCoords(
  element: ExcalidrawElement | ExcalidrawArrowElement
) {
  return [
    element.x, // x1
    element.y, // y1
    element.x + element.width, // x2
    element.y + element.height // y2
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

export function getArrowPoints(element: ExcalidrawArrowElement) {
  let x1, y1, x2, y2;
  if (element.angle < 0 && element.angle >= -90) {
    x1 = 0;
    y1 = element.height;
    x2 = element.width;
    y2 = 0;
  } else if (element.angle < -90) {
    x1 = element.width;
    y1 = element.height;
    x2 = 0;
    y2 = 0;
  } else if (element.angle > 90) {
    x1 = element.width;
    y1 = 0;
    x2 = 0;
    y2 = element.height;
  } else {
    x1 = 0;
    y1 = 0;
    x2 = element.width;
    y2 = element.height;
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

export function getLinePoints(element: ExcalidrawElement) {
  const x1 = 0;
  const y1 = 0;
  const x2 = element.width;
  const y2 = element.height;

  return [x1, y1, x2, y2];
}
