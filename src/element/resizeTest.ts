import {
  ExcalidrawElement,
  PointerType,
  NonDeletedExcalidrawElement,
} from "./types";

import {
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  getResizeHandlesFromCoords,
  getResizeHandles,
  ResizeHandleSide,
  ResizeHandle,
  MaybeResizeHandleSide,
} from "./resizeHandles";
import { AppState } from "../types";

const isInsideResizeHandle = (
  resizeHandle: ResizeHandle,
  x: number,
  y: number,
) =>
  x >= resizeHandle[0] &&
  x <= resizeHandle[0] + resizeHandle[2] &&
  y >= resizeHandle[1] &&
  y <= resizeHandle[1] + resizeHandle[3];

export const resizeTest = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
  zoom: number,
  pointerType: PointerType,
): MaybeResizeHandleSide => {
  if (!appState.selectedElementIds[element.id]) {
    return false;
  }

  const { rotation: rotationResizeHandle, ...resizeHandles } = getResizeHandles(
    element,
    zoom,
    pointerType,
  );

  if (
    rotationResizeHandle &&
    isInsideResizeHandle(rotationResizeHandle, x, y)
  ) {
    return "rotation" as ResizeHandleSide;
  }

  const filter = Object.keys(resizeHandles).filter((key) => {
    const resizeHandle = resizeHandles[
      key as Exclude<ResizeHandleSide, "rotation">
    ]!;
    if (!resizeHandle) {
      return false;
    }
    return isInsideResizeHandle(resizeHandle, x, y);
  });

  if (filter.length > 0) {
    return filter[0] as ResizeHandleSide;
  }

  return false;
};

export const getElementWithResizeHandleSide = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  scenePointerX: number,
  scenePointerY: number,
  zoom: number,
  pointerType: PointerType,
) => {
  return elements.reduce((result, element) => {
    if (result) {
      return result;
    }
    const resizeHandleSide = resizeTest(
      element,
      appState,
      scenePointerX,
      scenePointerY,
      zoom,
      pointerType,
    );
    return resizeHandleSide ? { element, resizeHandleSide } : null;
  }, null as { element: NonDeletedExcalidrawElement; resizeHandleSide: MaybeResizeHandleSide } | null);
};

export const getResizeHandleSideFromCoords = (
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  scenePointerX: number,
  scenePointerY: number,
  zoom: number,
  pointerType: PointerType,
): MaybeResizeHandleSide => {
  const resizeHandles = getResizeHandlesFromCoords(
    [x1, y1, x2, y2],
    0,
    zoom,
    pointerType,
    OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  );

  const found = Object.keys(resizeHandles).find((key) => {
    const resizeHandle = resizeHandles[
      key as Exclude<ResizeHandleSide, "rotation">
    ]!;
    return (
      resizeHandle &&
      isInsideResizeHandle(resizeHandle, scenePointerX, scenePointerY)
    );
  });
  return (found || false) as MaybeResizeHandleSide;
};

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
export const getCursorForResizingElement = (resizingElement: {
  element?: ExcalidrawElement;
  resizeHandleSide: MaybeResizeHandleSide;
}): string => {
  const { element, resizeHandleSide } = resizingElement;
  const shouldSwapCursors =
    element && Math.sign(element.height) * Math.sign(element.width) === -1;
  let cursor = null;

  switch (resizeHandleSide) {
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
};

export const normalizeResizeHandleSide = (
  element: ExcalidrawElement,
  resizeHandleSide: ResizeHandleSide,
): ResizeHandleSide => {
  if (element.width >= 0 && element.height >= 0) {
    return resizeHandleSide;
  }

  if (element.width < 0 && element.height < 0) {
    switch (resizeHandleSide) {
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
    switch (resizeHandleSide) {
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
    switch (resizeHandleSide) {
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

  return resizeHandleSide;
};
