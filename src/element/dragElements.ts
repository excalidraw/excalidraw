import { updateBoundElements } from "./binding";
import { Bounds, getCommonBounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { getPerfectElementSize } from "./sizeHelpers";
import { NonDeletedExcalidrawElement } from "./types";
import { AppState, PointerDownState } from "../types";
import { getBoundTextElement } from "./textElement";
import { isSelectedViaGroup } from "../groups";
import { getGridPoint } from "../math";
import Scene from "../scene/Scene";
import { isFrameElement } from "./typeChecks";

export const dragSelectedElements = (
  pointerDownState: PointerDownState,
  selectedElements: NonDeletedExcalidrawElement[],
  offset: { x: number; y: number },
  appState: AppState,
  scene: Scene,
  snapOffset: {
    x: number;
    y: number;
  },
  gridSize: AppState["gridSize"],
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

  const commonBounds = getCommonBounds(
    Array.from(elementsToUpdate).map(
      (el) => pointerDownState.originalElements.get(el.id) ?? el,
    ),
  );
  const adjustedOffset = calculateOffset(
    commonBounds,
    offset,
    snapOffset,
    gridSize,
  );

  elementsToUpdate.forEach((element) => {
    updateElementCoords(pointerDownState, element, adjustedOffset);
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
        updateElementCoords(pointerDownState, textElement, adjustedOffset);
      }
    }
    updateBoundElements(element, {
      simultaneouslyUpdated: Array.from(elementsToUpdate),
    });
  });
};

const calculateOffset = (
  commonBounds: Bounds,
  dragOffset: { x: number; y: number },
  snapOffset: { x: number; y: number },
  gridSize: AppState["gridSize"],
): { x: number; y: number } => {
  const [x, y] = commonBounds;
  let nextX = x + dragOffset.x + snapOffset.x;
  let nextY = y + dragOffset.y + snapOffset.y;

  if (snapOffset.x === 0 || snapOffset.y === 0) {
    const [nextGridX, nextGridY] = getGridPoint(
      x + dragOffset.x,
      y + dragOffset.y,
      gridSize,
    );

    if (snapOffset.x === 0) {
      nextX = nextGridX;
    }

    if (snapOffset.y === 0) {
      nextY = nextGridY;
    }
  }
  return {
    x: nextX - x,
    y: nextY - y,
  };
};

const updateElementCoords = (
  pointerDownState: PointerDownState,
  element: NonDeletedExcalidrawElement,
  dragOffset: { x: number; y: number },
) => {
  const originalElement =
    pointerDownState.originalElements.get(element.id) ?? element;

  const nextX = originalElement.x + dragOffset.x;
  const nextY = originalElement.y + dragOffset.y;

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
  /** whether to keep given aspect ratio when `isResizeWithSidesSameLength` is
      true */
  widthAspectRatio?: number | null,
  originOffset: {
    x: number;
    y: number;
  } | null = null,
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
      x: newX + (originOffset?.x ?? 0),
      y: newY + (originOffset?.y ?? 0),
      width,
      height,
    });
  }
};
