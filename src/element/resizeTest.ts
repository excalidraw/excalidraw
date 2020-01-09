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
