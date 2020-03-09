import { ExcalidrawElement, PointerType } from "./types";

import { handlerRectangles } from "./handlerRectangles";
import { AppState } from "../types";

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;

export function resizeTest(
  element: ExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
  zoom: number,
  pointerType: PointerType,
): HandlerRectanglesRet | false {
  if (!appState.selectedElementIds[element.id] || element.type === "text") {
    return false;
  }

  const handlers = handlerRectangles(element, zoom, pointerType);

  const filter = Object.keys(handlers).filter(key => {
    const handler = handlers[key as HandlerRectanglesRet]!;
    if (!handler) {
      return false;
    }

    return (
      x >= handler[0] &&
      x <= handler[0] + handler[2] &&
      y >= handler[1] &&
      y <= handler[1] + handler[3]
    );
  });

  if (filter.length > 0) {
    return filter[0] as HandlerRectanglesRet;
  }

  return false;
}

export function getElementWithResizeHandler(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  { x, y }: { x: number; y: number },
  zoom: number,
  pointerType: PointerType,
) {
  return elements.reduce((result, element) => {
    if (result) {
      return result;
    }
    const resizeHandle = resizeTest(element, appState, x, y, zoom, pointerType);
    return resizeHandle ? { element, resizeHandle } : null;
  }, null as { element: ExcalidrawElement; resizeHandle: ReturnType<typeof resizeTest> } | null);
}

/*
 * Returns bi-directional cursor for the element being resized
 */
export function getCursorForResizingElement(resizingElement: {
  element: ExcalidrawElement;
  resizeHandle: ReturnType<typeof resizeTest>;
}): string {
  const { element, resizeHandle } = resizingElement;
  const shouldSwapCursors =
    Math.sign(element.height) * Math.sign(element.width) === -1;
  let cursor = null;

  switch (resizeHandle) {
    case "n":
    case "s":
      cursor = "ns";
      break;
    case "w":
    case "e":
      cursor = "ew";
      break;
    case "nw":
    case "se":
      if (shouldSwapCursors) {
        cursor = "nesw";
      } else {
        cursor = "nwse";
      }
      break;
    case "ne":
    case "sw":
      if (shouldSwapCursors) {
        cursor = "nwse";
      } else {
        cursor = "nesw";
      }
      break;
  }

  return cursor ? `${cursor}-resize` : "";
}

export function normalizeResizeHandle(
  element: ExcalidrawElement,
  resizeHandle: HandlerRectanglesRet,
): HandlerRectanglesRet {
  if (
    (element.width >= 0 && element.height >= 0) ||
    element.type === "line" ||
    element.type === "arrow"
  ) {
    return resizeHandle;
  }

  if (element.width < 0 && element.height < 0) {
    switch (resizeHandle) {
      case "nw":
        return "se";
      case "ne":
        return "sw";
      case "se":
        return "nw";
      case "sw":
        return "ne";
    }
  } else if (element.width < 0) {
    switch (resizeHandle) {
      case "nw":
        return "ne";
      case "ne":
        return "nw";
      case "se":
        return "sw";
      case "sw":
        return "se";
      case "e":
        return "w";
      case "w":
        return "e";
    }
  } else {
    switch (resizeHandle) {
      case "nw":
        return "sw";
      case "ne":
        return "se";
      case "se":
        return "ne";
      case "sw":
        return "nw";
      case "n":
        return "s";
      case "s":
        return "n";
    }
  }

  return resizeHandle;
}
