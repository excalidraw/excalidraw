import {
  ExcalidrawElement,
  PointerType,
  NonDeletedExcalidrawElement,
} from "./types";

import {
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  handlerRectanglesFromCoords,
  handlerRectangles,
} from "./handlerRectangles";
import { AppState } from "../types";

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;

function isInHandlerRect(
  handler: [number, number, number, number],
  x: number,
  y: number,
) {
  return (
    x >= handler[0] &&
    x <= handler[0] + handler[2] &&
    y >= handler[1] &&
    y <= handler[1] + handler[3]
  );
}

export function resizeTest(
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
  zoom: number,
  pointerType: PointerType,
): HandlerRectanglesRet | false {
  if (!appState.selectedElementIds[element.id]) {
    return false;
  }

  const { rotation: rotationHandler, ...handlers } = handlerRectangles(
    element,
    zoom,
    pointerType,
  );

  if (rotationHandler && isInHandlerRect(rotationHandler, x, y)) {
    return "rotation" as HandlerRectanglesRet;
  }

  if (element.type === "text") {
    // can't resize text elements
    return false;
  }

  const filter = Object.keys(handlers).filter((key) => {
    const handler = handlers[key as Exclude<HandlerRectanglesRet, "rotation">]!;
    if (!handler) {
      return false;
    }
    return isInHandlerRect(handler, x, y);
  });

  if (filter.length > 0) {
    return filter[0] as HandlerRectanglesRet;
  }

  return false;
}

export function getElementWithResizeHandler(
  elements: readonly NonDeletedExcalidrawElement[],
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
  }, null as { element: NonDeletedExcalidrawElement; resizeHandle: ReturnType<typeof resizeTest> } | null);
}

export function getResizeHandlerFromCoords(
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  { x, y }: { x: number; y: number },
  zoom: number,
  pointerType: PointerType,
) {
  const handlers = handlerRectanglesFromCoords(
    [x1, y1, x2, y2],
    0,
    zoom,
    pointerType,
    OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  );

  const found = Object.keys(handlers).find((key) => {
    const handler = handlers[key as Exclude<HandlerRectanglesRet, "rotation">]!;
    return handler && isInHandlerRect(handler, x, y);
  });
  return (found || false) as HandlerRectanglesRet;
}

const RESIZE_CURSORS = ["ns", "nesw", "ew", "nwse"];
const rotateResizeCursor = (cursor: string, angle: number) => {
  const index = RESIZE_CURSORS.indexOf(cursor);
  if (index >= 0) {
    const a = Math.round(angle / (Math.PI / 4));
    cursor = RESIZE_CURSORS[(index + a) % RESIZE_CURSORS.length];
  }
  return cursor;
};

/*
 * Returns bi-directional cursor for the element being resized
 */
export function getCursorForResizingElement(resizingElement: {
  element?: ExcalidrawElement;
  resizeHandle: ReturnType<typeof resizeTest>;
}): string {
  const { element, resizeHandle } = resizingElement;
  const shouldSwapCursors =
    element && Math.sign(element.height) * Math.sign(element.width) === -1;
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
    case "rotation":
      return "grab";
  }

  if (cursor && element) {
    cursor = rotateResizeCursor(cursor, element.angle);
  }

  return cursor ? `${cursor}-resize` : "";
}

export function normalizeResizeHandle(
  element: ExcalidrawElement,
  resizeHandle: HandlerRectanglesRet,
): HandlerRectanglesRet {
  if (element.width >= 0 && element.height >= 0) {
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
