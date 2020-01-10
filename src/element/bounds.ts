import { ExcalidrawElement } from "./types";
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

export function getArrowPoints(element: ExcalidrawElement) {
  const x1 = 0;
  const y1 = 0;
  const x2 = element.width;
  const y2 = element.height;

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

export function getServerPoints(element: ExcalidrawElement) {
  const w = element.width;
  const h = element.height;
  const offsetHeight = h * 0.05;

  /*
  ___ 2 ___
  1           3
  4 --- 5 --- 6          
  7 --------- 8        
  9 -- 10 -- 11          
  12         14         
  -- 13 --
  */

  const [ax1, ay1] = getElementAbsoluteCoords(element);

  const x1 = ax1 + 0;
  const y1 = ay1 + offsetHeight;
  const x2 = ax1 + w / 2;
  const y2 = ay1 + 0;
  const x3 = ax1 + w;
  const y3 = ay1 + offsetHeight;

  const x4 = ax1 + 0;
  const y4 = ay1 + h * 0.25 + offsetHeight / 2;
  const x5 = ax1 + w / 2;
  const y5 = ay1 + h * 0.25 - offsetHeight / 2;
  const x6 = ax1 + w;
  const y6 = ay1 + h * 0.25 + offsetHeight / 2;
  const x7 = ax1 + 0;
  const y7 = ay1 + h / 2;
  const x8 = ax1 + w;
  const y8 = ay1 + h / 2;
  const x9 = ax1 + 0;
  const y9 = ay1 + h * 0.75 - offsetHeight / 2;
  const x10 = ax1 + w / 2;
  const y10 = ay1 + h * 0.75 + offsetHeight / 2;
  const x11 = ax1 + w;
  const y11 = ay1 + h * 0.75 - offsetHeight / 2;
  const x12 = ax1 + 0;
  const y12 = ay1 + h - offsetHeight;
  const x13 = ax1 + w / 2;
  const y13 = ay1 + h;
  const x14 = ax1 + w;
  const y14 = ay1 + h - offsetHeight;

  // prettier-ignore
  return [ 
    x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6, x7, y7, 
    x8, y8, x9, y9, x10, y10, x11, y11, x12, y12, x13, y13, x14, y14
  ]
}
