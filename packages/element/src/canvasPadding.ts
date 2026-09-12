import type { ExcalidrawElement } from "./types";

// the amount of padding (in canvas/device pixels, i.e. already accounting
// for devicePixelRatio) reserved around an element's offscreen render
// canvas, to avoid clipping ascenders/descenders, anti-aliased edges, or
// other paint that extends past an element's logical bounds.
export const getCanvasPadding = (element: ExcalidrawElement) => {
  switch (element.type) {
    case "freedraw":
      return element.strokeWidth * 12;
    case "text":
      return element.fontSize / 2;
    case "arrow":
      if (element.endArrowhead || element.endArrowhead) {
        return 40;
      }
      return 20;
    default:
      return 20;
  }
};
