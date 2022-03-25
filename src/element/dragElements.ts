import { updateBoundElements } from "./binding";
import { getCommonBounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { getPerfectElementSize } from "./sizeHelpers";
import { NonDeletedExcalidrawElement } from "./types";
import { AppState, PointerDownState } from "../types";
import { getBoundTextElement } from "./textElement";
import { isSelectedViaGroup } from "../groups";

export const dragSelectedElements = (
  pointerDownState: PointerDownState,
  selectedElements: NonDeletedExcalidrawElement[],
  pointerX: number,
  pointerY: number,
  lockDirection: boolean = false,
  distanceX: number = 0,
  distanceY: number = 0,
  appState: AppState,
) => {
  const [x1, y1] = getCommonBounds(selectedElements);
  const offset = { x: pointerX - x1, y: pointerY - y1 };
  selectedElements.forEach((element) => {
    updateElementCoords(
      lockDirection,
      distanceX,
      distanceY,
      pointerDownState,
      element,
      offset,
    );
    // update coords of bound text only if we're dragging the container directly
    // (we don't drag the group that it's part of)
    if (
      // container isn't part of any group
      // (perf optim so we don't check `isSelectedViaGroup()` in every case)
      !element.groupIds.length ||
      // container is part of a group, but we're dragging the container directly
      (appState.editingGroupId && !isSelectedViaGroup(appState, element))
    ) {
      const textElement = getBoundTextElement(element);
      if (textElement) {
        updateElementCoords(
          lockDirection,
          distanceX,
          distanceY,
          pointerDownState,
          textElement,
          offset,
        );
      }
    }
    updateBoundElements(element, {
      simultaneouslyUpdated: selectedElements,
    });
  });
};

const updateElementCoords = (
  lockDirection: boolean,
  distanceX: number,
  distanceY: number,
  pointerDownState: PointerDownState,
  element: NonDeletedExcalidrawElement,
  offset: { x: number; y: number },
) => {
  let x: number;
  let y: number;
  if (lockDirection) {
    const lockX = lockDirection && distanceX < distanceY;
    const lockY = lockDirection && distanceX > distanceY;
    const original = pointerDownState.originalElements.get(element.id);
    x = lockX && original ? original.x : element.x + offset.x;
    y = lockY && original ? original.y : element.y + offset.y;
  } else {
    x = element.x + offset.x;
    y = element.y + offset.y;
  }

  mutateElement(element, {
    x,
    y,
  });
};
export const getDragOffsetXY = (
  selectedElements: NonDeletedExcalidrawElement[],
  x: number,
  y: number,
): [number, number] => {
  const [x1, y1] = getCommonBounds(selectedElements);
  return [x - x1, y - y1];
};

export const dragNewElement = (
  draggingElement: NonDeletedExcalidrawElement,
  elementType: AppState["activeTool"]["type"],
  originX: number,
  originY: number,
  x: number,
  y: number,
  width: number,
  height: number,
  shouldMaintainAspectRatio: boolean,
  shouldResizeFromCenter: boolean,
  /** whether to keep given aspect ratio when `isResizeWithSidesSameLength` is
      true */
  widthAspectRatio?: number | null,
) => {
  if (shouldMaintainAspectRatio) {
    if (widthAspectRatio) {
      height = width / widthAspectRatio;
    } else {
      ({ width, height } = getPerfectElementSize(
        elementType,
        width,
        y < originY ? -height : height,
      ));

      if (height < 0) {
        height = -height;
      }
    }
  }

  let newX = x < originX ? originX - width : originX;
  let newY = y < originY ? originY - height : originY;

  if (shouldResizeFromCenter) {
    width += width;
    height += height;
    newX = originX - width / 2;
    newY = originY - height / 2;
  }

  if (width !== 0 && height !== 0) {
    mutateElement(draggingElement, {
      x: newX,
      y: newY,
      width,
      height,
    });
  }
};
