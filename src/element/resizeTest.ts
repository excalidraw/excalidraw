import { ExcalidrawElement } from "./types";

import { handlerRectangles } from "./handlerRectangles";
import { SceneScroll } from "../scene/types";

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;

export function resizeTest(
  element: ExcalidrawElement,
  x: number,
  y: number,
  { scrollX, scrollY }: SceneScroll
): HandlerRectanglesRet | false {
  if (!element.isSelected || element.type === "text") return false;

  const handlers = handlerRectangles(element, { scrollX, scrollY });

  const filter = Object.keys(handlers).filter(key => {
    const handler = handlers[key as HandlerRectanglesRet]!;

    return (
      x + scrollX >= handler[0] &&
      x + scrollX <= handler[0] + handler[2] &&
      y + scrollY >= handler[1] &&
      y + scrollY <= handler[1] + handler[3]
    );
  });

  if (filter.length > 0) {
    return filter[0] as HandlerRectanglesRet;
  }

  return false;
}

export function getElementWithResizeHandler(
  elements: readonly ExcalidrawElement[],
  { x, y }: { x: number; y: number },
  { scrollX, scrollY }: SceneScroll
) {
  return elements.reduce((result, element) => {
    if (result) {
      return result;
    }
    const resizeHandle = resizeTest(element, x, y, {
      scrollX,
      scrollY
    });
    return resizeHandle ? { element, resizeHandle } : null;
  }, null as { element: ExcalidrawElement; resizeHandle: ReturnType<typeof resizeTest> } | null);
}

type ResizerFunction = (
  element: ExcalidrawElement,
  e: MouseEvent,
  { x, y }: { x: number; y: number },
  { lastX, lastY }: { lastX: number; lastY: number }
) => void;

export const resizer: { [key: string]: ResizerFunction } = {
  nw: (element, e, { x, y }, { lastX, lastY }) => {
    const deltaX = lastX - x;
    element.width += deltaX;
    element.x -= deltaX;
    if (e.shiftKey) {
      element.y += element.height - element.width;
      element.height = element.width;
    } else {
      const deltaY = lastY - y;
      element.height += deltaY;
      element.y -= deltaY;
    }
  },
  ne: (element, e, { x, y }, { lastX, lastY }) => {
    element.width += x - lastX;
    if (e.shiftKey) {
      element.y += element.height - element.width;
      element.height = element.width;
    } else {
      const deltaY = lastY - y;
      element.height += deltaY;
      element.y -= deltaY;
    }
  },
  sw: (element, e, { x, y }, { lastX, lastY }) => {
    const deltaX = lastX - x;
    element.width += deltaX;
    element.x -= deltaX;
    if (e.shiftKey) {
      element.height = element.width;
    } else {
      element.height += y - lastY;
    }
  },
  se: (element, e, { x, y }, { lastX, lastY }) => {
    element.width += x - lastX;
    if (e.shiftKey) {
      element.height = element.width;
    } else {
      element.height += y - lastY;
    }
  },
  n: (element, e, { x, y }, { lastX, lastY }) => {
    const deltaY = lastY - y;
    element.height += deltaY;
    element.y -= deltaY;
  },
  w: (element, e, { x, y }, { lastX, lastY }) => {
    const deltaX = lastX - x;
    element.width += deltaX;
    element.x -= deltaX;
  },
  s: (element, e, { x, y }, { lastX, lastY }) => {
    element.height += y - lastY;
  },
  e: (element, e, { x, y }, { lastX, lastY }) => {
    element.width += x - lastX;
  }
};
