import {
  ExcalidrawElement,
  PointerType,
  NonDeletedExcalidrawElement,
} from "./types";

import {
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  getTransformHandlesFromCoords,
  getTransformHandles,
  TransformHandleSide,
  TransformHandle,
  MaybeTransformHandleSide,
} from "./transformHandles";
import { AppState } from "../types";

const isInsideTransformHandle = (
  transformHandle: TransformHandle,
  x: number,
  y: number,
) =>
  x >= transformHandle[0] &&
  x <= transformHandle[0] + transformHandle[2] &&
  y >= transformHandle[1] &&
  y <= transformHandle[1] + transformHandle[3];

export const resizeTest = (
  element: NonDeletedExcalidrawElement,
  appState: AppState,
  x: number,
  y: number,
  zoom: number,
  pointerType: PointerType,
): MaybeTransformHandleSide => {
  if (!appState.selectedElementIds[element.id]) {
    return false;
  }

  const {
    rotation: rotationTransformHandle,
    ...transformHandles
  } = getTransformHandles(element, zoom, pointerType);

  if (
    rotationTransformHandle &&
    isInsideTransformHandle(rotationTransformHandle, x, y)
  ) {
    return "rotation" as TransformHandleSide;
  }

  const filter = Object.keys(transformHandles).filter((key) => {
    const transformHandle = transformHandles[
      key as Exclude<TransformHandleSide, "rotation">
    ]!;
    if (!transformHandle) {
      return false;
    }
    return isInsideTransformHandle(transformHandle, x, y);
  });

  if (filter.length > 0) {
    return filter[0] as TransformHandleSide;
  }

  return false;
};

export const getElementWithTransformHandleSide = (
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
    const transformHandleSide = resizeTest(
      element,
      appState,
      scenePointerX,
      scenePointerY,
      zoom,
      pointerType,
    );
    return transformHandleSide ? { element, transformHandleSide } : null;
  }, null as { element: NonDeletedExcalidrawElement; transformHandleSide: MaybeTransformHandleSide } | null);
};

export const getTransformHandleSideFromCoords = (
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  scenePointerX: number,
  scenePointerY: number,
  zoom: number,
  pointerType: PointerType,
): MaybeTransformHandleSide => {
  const transformHandles = getTransformHandlesFromCoords(
    [x1, y1, x2, y2],
    0,
    zoom,
    pointerType,
    OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  );

  const found = Object.keys(transformHandles).find((key) => {
    const transformHandle = transformHandles[
      key as Exclude<TransformHandleSide, "rotation">
    ]!;
    return (
      transformHandle &&
      isInsideTransformHandle(transformHandle, scenePointerX, scenePointerY)
    );
  });
  return (found || false) as MaybeTransformHandleSide;
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
  transformHandleSide: MaybeTransformHandleSide;
}): string => {
  const { element, transformHandleSide } = resizingElement;
  const shouldSwapCursors =
    element && Math.sign(element.height) * Math.sign(element.width) === -1;
  let cursor = null;

  switch (transformHandleSide) {
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

export const normalizeTransformHandleSide = (
  element: ExcalidrawElement,
  transformHandleSide: TransformHandleSide,
): TransformHandleSide => {
  if (element.width >= 0 && element.height >= 0) {
    return transformHandleSide;
  }

  if (element.width < 0 && element.height < 0) {
    switch (transformHandleSide) {
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
    switch (transformHandleSide) {
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
    switch (transformHandleSide) {
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

  return transformHandleSide;
};
