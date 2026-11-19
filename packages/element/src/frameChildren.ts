// Frame membership lookup. A leaf module so selection doesn't depend on frame.

import type { ElementsMapOrArray, ExcalidrawElement } from "./types";

export const getFrameChildren = (
  allElements: ElementsMapOrArray,
  frameId: string,
) => {
  const frameChildren: ExcalidrawElement[] = [];
  for (const element of allElements.values()) {
    if (element.frameId === frameId) {
      frameChildren.push(element);
    }
  }
  return frameChildren;
};
