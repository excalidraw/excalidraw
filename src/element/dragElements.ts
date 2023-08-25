import { updateBoundElements } from "./binding";
import { getCommonBounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { getPerfectElementSize } from "./sizeHelpers";
import { NonDeletedExcalidrawElement } from "./types";
import { AppState, Point, PointerDownState } from "../types";
import { getBoundTextElement } from "./textElement";
import { isSelectedViaGroup } from "../groups";
import { GapSnaps, Snaps, getNearestSnaps, snapProject } from "../snapping";
import { getGridPoint } from "../math";
import Scene from "../scene/Scene";
import { isFrameElement } from "./typeChecks";
import * as GAPoints from "../gapoints";

export const dragSelectedElements = (
  pointerDownState: PointerDownState,
  selectedElements: NonDeletedExcalidrawElement[],
  offset: { x: number; y: number },
  appState: AppState,
  scene: Scene,
  snaps: Snaps | null = null,
  gapSnaps: GapSnaps = [],
) => {
  // we do not want a frame and its elements to be selected at the same time
  // but when it happens (due to some bug), we want to avoid updating element
  // in the frame twice, hence the use of set
  const elementsToUpdate = new Set<NonDeletedExcalidrawElement>(
    selectedElements,
  );
  const frames = selectedElements
    .filter((e) => isFrameElement(e))
    .map((f) => f.id);

  if (frames.length > 0) {
    const elementsInFrames = scene
      .getNonDeletedElements()
      .filter((e) => e.frameId !== null)
      .filter((e) => frames.includes(e.frameId!));

    elementsInFrames.forEach((element) => elementsToUpdate.add(element));
  }

  elementsToUpdate.forEach((element) => {
    updateElementCoords(
      pointerDownState,
      element,
      offset,
      appState,
      snaps,
      gapSnaps,
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
      if (
        textElement &&
        // when container is added to a frame, so will its bound text
        // so the text is already in `elementsToUpdate` and we should avoid
        // updating its coords again
        (!textElement.frameId || !frames.includes(textElement.frameId))
      ) {
        updateElementCoords(
          pointerDownState,
          textElement,
          offset,
          appState,
          snaps,
          gapSnaps,
        );
      }
    }
    updateBoundElements(element, {
      simultaneouslyUpdated: Array.from(elementsToUpdate),
    });
  });
};

const updateElementCoords = (
  pointerDownState: PointerDownState,
  element: NonDeletedExcalidrawElement,
  offset: { x: number; y: number },
  appState: AppState,
  snaps: Snaps | null = null,
  gapSnaps: GapSnaps = [],
) => {
  const originalElement =
    pointerDownState.originalElements.get(element.id) ?? element;

  const origin = {
    x: originalElement.x,
    y: originalElement.y,
  };

  const nextDragX = origin.x + offset.x;
  const nextDragY = origin.y + offset.y;

  let nextX = nextDragX;
  let nextY = nextDragY;

  if (snaps && snaps.length > 0) {
    [nextX, nextY] = snapProject({
      origin,
      offset,
      snaps,
      zoom: appState.zoom,
    });
  }

  for (const gapSnap of gapSnaps) {
    switch (gapSnap.direction) {
      case "center_horizontal": {
        nextX = nextDragX + gapSnap.offset;
        break;
      }
      case "center_vertical": {
        nextY = nextDragY + gapSnap.offset;
        break;
      }
      case "side_right": {
        nextX = nextDragX - gapSnap.offset;
        break;
      }
      case "side_left": {
        nextX = nextDragX + gapSnap.offset;
        break;
      }
      case "side_bottom": {
        nextY = nextDragY - gapSnap.offset;
        break;
      }
      case "side_top": {
        nextY = nextDragY + gapSnap.offset;
        break;
      }
    }
  }

  if ((!snaps || snaps.length === 0) && gapSnaps.length === 0) {
    [nextX, nextY] = getGridPoint(
      origin.x + offset.x,
      origin.y + offset.y,
      appState.gridSize,
    );
  }

  mutateElement(element, {
    x: nextX,
    y: nextY,
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
  appState: AppState,
  /** whether to keep given aspect ratio when `isResizeWithSidesSameLength` is
      true */
  widthAspectRatio?: number | null,
  snaps: Snaps | null = null,
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

  if (snaps) {
    let cornerX: number = newX + width;
    let cornerY: number = newY + height;
    if (x < originX) {
      cornerX = newX;
    }
    if (y < originY) {
      cornerY = newY;
    }

    const corner: Point = [cornerX, cornerY];

    const { horizontalSnap, verticalSnap } = getNearestSnaps(
      corner,
      snaps,
      appState,
    );

    if (horizontalSnap) {
      const snapPoint = GAPoints.toTuple(horizontalSnap.snapLine.point);
      height = snapPoint[1] - newY;

      if (y < originY) {
        newY = snapPoint[1];
        height = originY - newY;
      }

      if (shouldMaintainAspectRatio) {
        if (widthAspectRatio) {
          width = height * widthAspectRatio;
        } else {
          width = height;
        }
      }

      if (y < originY) {
        newY = snapPoint[1];
      }

      if (x < originX) {
        newX = originX - width;
      }
    }

    if (verticalSnap) {
      const snapPoint = GAPoints.toTuple(verticalSnap.snapLine.point);
      width = GAPoints.toTuple(verticalSnap.snapLine.point)[0] - newX;

      if (x < originX) {
        newX = snapPoint[0];
        width = originX - newX;
      }

      if (shouldMaintainAspectRatio) {
        if (widthAspectRatio) {
          height = width / widthAspectRatio;
        } else {
          height = width;
        }
      }

      if (x < originX) {
        newX = snapPoint[0];
      }

      if (y < originY) {
        newY = originY - height;
      }
    }
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
