import {
  ExcalidrawElement,
  PointerType,
  NonDeletedExcalidrawElement,
} from "./types";

import {
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  getTransformHandlesFromCoords,
  getTransformHandles,
  TransformHandleType,
  TransformHandle,
  MaybeTransformHandleType,
} from "./transformHandles";
import { AppState, Zoom } from "../types";

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
  zoom: Zoom,
  pointerType: PointerType,
): MaybeTransformHandleType => {
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
    return "rotation" as TransformHandleType;
  }

  const filter = Object.keys(transformHandles).filter((key) => {
    const transformHandle = transformHandles[
      key as Exclude<TransformHandleType, "rotation">
    ]!;
    if (!transformHandle) {
      return false;
    }
    return isInsideTransformHandle(transformHandle, x, y);
  });

  if (filter.length > 0) {
    return filter[0] as TransformHandleType;
  }

  return false;
};

export const getElementWithTransformHandleType = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  scenePointerX: number,
  scenePointerY: number,
  zoom: Zoom,
  pointerType: PointerType,
) => {
  return elements.reduce((result, element) => {
    if (result) {
      return result;
    }
    const transformHandleType = resizeTest(
      element,
      appState,
      scenePointerX,
      scenePointerY,
      zoom,
      pointerType,
    );
    return transformHandleType ? { element, transformHandleType } : null;
  }, null as { element: NonDeletedExcalidrawElement; transformHandleType: MaybeTransformHandleType } | null);
};

export const getTransformHandleTypeFromCoords = (
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  scenePointerX: number,
  scenePointerY: number,
  zoom: Zoom,
  pointerType: PointerType,
): MaybeTransformHandleType => {
  const transformHandles = getTransformHandlesFromCoords(
    [x1, y1, x2, y2],
    0,
    zoom,
    pointerType,
    OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  );

  const found = Object.keys(transformHandles).find((key) => {
    const transformHandle = transformHandles[
      key as Exclude<TransformHandleType, "rotation">
    ]!;
    return (
      transformHandle &&
      isInsideTransformHandle(transformHandle, scenePointerX, scenePointerY)
    );
  });
  return (found || false) as MaybeTransformHandleType;
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
  transformHandleType: MaybeTransformHandleType;
}): string => {
  const { element, transformHandleType } = resizingElement;
  const shouldSwapCursors =
    element && Math.sign(element.height) * Math.sign(element.width) === -1;
  let cursor = null;

  switch (transformHandleType) {
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
