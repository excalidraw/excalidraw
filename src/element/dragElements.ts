import { updateBoundElements } from "./binding";
import { getCommonBounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { getPerfectElementSize } from "./sizeHelpers";
import { NonDeletedExcalidrawElement } from "./types";
import { AppState, PointerDownState } from "../types";
import { getBoundTextElement } from "./textElement";
import { isSelectedViaGroup } from "../groups";
import { Snaps, snapProject } from "../snapping";
import { getGridPoint } from "../math";

export const dragSelectedElements = (
  pointerDownState: PointerDownState,
  selectedElements: NonDeletedExcalidrawElement[],
  offset: { x: number; y: number },
  lockDirection: boolean = false,
  appState: AppState,
  snaps: Snaps | null = null,
) => {
  selectedElements.forEach((element) => {
    updateElementCoords(
      lockDirection,
      pointerDownState,
      element,
      offset,
      appState,
      snaps,
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
          pointerDownState,
          textElement,
          offset,
          appState,
          snaps,
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
  pointerDownState: PointerDownState,
  element: NonDeletedExcalidrawElement,
  offset: { x: number; y: number },
  appState: AppState,
  snaps: Snaps | null = null,
) => {
  const distanceX = Math.abs(offset.x);
  const distanceY = Math.abs(offset.y);

  const lockX = lockDirection && distanceX < distanceY;
  const lockY = lockDirection && distanceX > distanceY;

  const originalElement =
    pointerDownState.originalElements.get(element.id) ?? element;

  const origin = {
    x: originalElement.x,
    y: originalElement.y,
  };

  const [nextX, nextY] =
    !snaps || snaps.length === 0
      ? getGridPoint(
          lockX ? origin.x : origin.x + offset.x,
          lockY ? origin.y : origin.y + offset.y,
          appState.gridSize,
        )
      : snapProject({
          origin,
          offset,
          snaps,
          zoom: appState.zoom,
        });

  mutateElement(element, {
    x: lockX ? origin.x : nextX,
    y: lockY ? origin.y : nextY,
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
  if (shouldMaintainAspectRatio && draggingElement.type !== "selection") {
    if (widthAspectRatio) {
      height = width / widthAspectRatio;
    } else {
      // Depending on where the cursor is at (x, y) relative to where the starting point is
      // (originX, originY), we use ONLY width or height to control size increase.
      // This allows the cursor to always "stick" to one of the sides of the bounding box.
      if (Math.abs(y - originY) > Math.abs(x - originX)) {
        ({ width, height } = getPerfectElementSize(
          elementType,
          height,
          x < originX ? -width : width,
        ));
      } else {
        ({ width, height } = getPerfectElementSize(
          elementType,
          width,
          y < originY ? -height : height,
        ));
      }

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
