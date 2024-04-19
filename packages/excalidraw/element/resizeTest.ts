import {
  ExcalidrawElement,
  PointerType,
  NonDeletedExcalidrawElement,
  ElementsMap,
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
import { Bounds, getElementAbsoluteCoords } from "./bounds";
import { DEFAULT_TRANSFORM_HANDLE_SPACING } from "../constants";
import {
  angleToDegrees,
  pointOnLine,
  pointRotate,
} from "../../utils/geometry/geometry";
import { Line, Point } from "../../utils/geometry/shape";
import { isLinearElement } from "./typeChecks";

const SIDE_RESIZING_SPACING = DEFAULT_TRANSFORM_HANDLE_SPACING * 4.5;

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
  elementsMap: ElementsMap,
  appState: AppState,
  x: number,
  y: number,
  zoom: Zoom,
  pointerType: PointerType,
): MaybeTransformHandleType => {
  if (!appState.selectedElementIds[element.id]) {
    return false;
  }

  const { rotation: rotationTransformHandle, ...transformHandles } =
    getTransformHandles(element, zoom, elementsMap, pointerType);

  if (
    rotationTransformHandle &&
    isInsideTransformHandle(rotationTransformHandle, x, y)
  ) {
    return "rotation" as TransformHandleType;
  }

  const filter = Object.keys(transformHandles).filter((key) => {
    const transformHandle =
      transformHandles[key as Exclude<TransformHandleType, "rotation">]!;
    if (!transformHandle) {
      return false;
    }
    return isInsideTransformHandle(transformHandle, x, y);
  });

  if (filter.length > 0) {
    return filter[0] as TransformHandleType;
  }

  // Resize an element from the sides.
  // Note that for a text element, when "resized" from the side
  // we should make it wrap/unwrap

  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
  );

  if (
    element.type !== "text" &&
    !(isLinearElement(element) && element.points.length <= 2)
  ) {
    const SPACING = SIDE_RESIZING_SPACING / zoom.value;
    const HALF = DEFAULT_TRANSFORM_HANDLE_SPACING / zoom.value / 2;
    const sides = getSelectionBorders(
      [x1 - HALF, y1 - HALF],
      [x2 + HALF, y2 + HALF],
      [cx, cy],
      angleToDegrees(element.angle),
    );

    for (const [dir, side] of Object.entries(sides)) {
      // test to see if x, y are on the line segment
      if (pointOnLine([x, y], side as Line, SPACING)) {
        return dir as TransformHandleType;
      }
    }
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
  elementsMap: ElementsMap,
) => {
  return elements.reduce((result, element) => {
    if (result) {
      return result;
    }
    const transformHandleType = resizeTest(
      element,
      elementsMap,
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
  [x1, y1, x2, y2]: Bounds,
  scenePointerX: number,
  scenePointerY: number,
  zoom: Zoom,
  pointerType: PointerType,
): MaybeTransformHandleType => {
  const transformHandles = getTransformHandlesFromCoords(
    [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2],
    0,
    zoom,
    pointerType,
    OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  );

  const found = Object.keys(transformHandles).find((key) => {
    const transformHandle =
      transformHandles[key as Exclude<TransformHandleType, "rotation">]!;
    return (
      transformHandle &&
      isInsideTransformHandle(transformHandle, scenePointerX, scenePointerY)
    );
  });

  if (found) {
    return found as MaybeTransformHandleType;
  }

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const SPACING = SIDE_RESIZING_SPACING / zoom.value;
  const sides = getSelectionBorders(
    [x1 - SPACING, y1 - SPACING],
    [x2 + SPACING, y2 + SPACING],
    [cx, cy],
    angleToDegrees(0),
  );

  for (const [dir, side] of Object.entries(sides)) {
    // test to see if x, y are on the line segment
    if (pointOnLine([scenePointerX, scenePointerY], side as Line, SPACING)) {
      return dir as TransformHandleType;
    }
  }

  return false;
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

const getSelectionBorders = (
  [x1, y1]: Point,
  [x2, y2]: Point,
  center: Point,
  angleInDegrees: number,
) => {
  const topLeft = pointRotate([x1, y1], angleInDegrees, center);
  const topRight = pointRotate([x2, y1], angleInDegrees, center);
  const bottomLeft = pointRotate([x1, y2], angleInDegrees, center);
  const bottomRight = pointRotate([x2, y2], angleInDegrees, center);

  return {
    n: [topLeft, topRight],
    e: [topRight, bottomRight],
    s: [bottomRight, bottomLeft],
    w: [bottomLeft, topLeft],
  };
};
