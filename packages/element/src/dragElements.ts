import {
  type Bounds,
  TEXT_AUTOWRAP_THRESHOLD,
  getGridPoint,
  getFontString,
  DRAGGING_THRESHOLD,
} from "@excalidraw/common";

import type {
  AppState,
  NormalizedZoomValue,
  NullableGridSize,
  PointerDownState,
} from "@excalidraw/excalidraw/types";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { unbindBindingElement, updateBoundElements } from "./binding";
import { getCommonBounds } from "./bounds";
import { getPerfectElementSize } from "./sizeHelpers";
import { getBoundTextElement } from "./textElement";
import { getMinTextElementWidth } from "./textMeasurements";
import {
  isArrowElement,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isTextElement,
} from "./typeChecks";

import type { Scene } from "./Scene";

import type { ExcalidrawElement, ExcalidrawTextElement } from "./types";

export const dragSelectedElements = (
  pointerDownState: PointerDownState,
  _selectedElements: NonDeletedExcalidrawElement[],
  offset: { x: number; y: number },
  scene: Scene,
  snapOffset: {
    x: number;
    y: number;
  },
  gridSize: NullableGridSize,
) => {
  if (
    _selectedElements.length === 1 &&
    isElbowArrow(_selectedElements[0]) &&
    (_selectedElements[0].startBinding || _selectedElements[0].endBinding)
  ) {
    return;
  }

  const selectedElements = _selectedElements.filter((element) => {
    if (isElbowArrow(element) && element.startBinding && element.endBinding) {
      const startElement = _selectedElements.find(
        (el) => el.id === element.startBinding?.elementId,
      );
      const endElement = _selectedElements.find(
        (el) => el.id === element.endBinding?.elementId,
      );

      return startElement && endElement;
    }

    return true;
  });

  // we do not want a frame and its elements to be selected at the same time
  // but when it happens (due to some bug), we want to avoid updating element
  // in the frame twice, hence the use of set
  const elementsToUpdate = new Set<NonDeletedExcalidrawElement>(
    selectedElements,
  );
  const frames = selectedElements
    .filter((e) => isFrameLikeElement(e))
    .map((f) => f.id);

  if (frames.length > 0) {
    for (const element of scene.getNonDeletedElements()) {
      if (element.frameId !== null && frames.includes(element.frameId)) {
        elementsToUpdate.add(element);
      }
    }
  }

  const origElements: ExcalidrawElement[] = [];

  for (const element of elementsToUpdate) {
    const origElement = pointerDownState.originalElements.get(element.id);
    // if original element is not set (e.g. when you duplicate during a drag
    // operation), exit to avoid undefined behavior
    if (!origElement) {
      return;
    }
    origElements.push(origElement);
  }

  const adjustedOffset = calculateOffset(
    getCommonBounds(origElements),
    offset,
    snapOffset,
    gridSize,
  );

  const elementsToUpdateIds = new Set(
    Array.from(elementsToUpdate, (el) => el.id),
  );

  elementsToUpdate.forEach((element) => {
    const isArrow = !isArrowElement(element);
    const isStartBoundElementSelected =
      isArrow ||
      (element.startBinding
        ? elementsToUpdateIds.has(element.startBinding.elementId)
        : false);
    const isEndBoundElementSelected =
      isArrow ||
      (element.endBinding
        ? elementsToUpdateIds.has(element.endBinding.elementId)
        : false);

    if (!isArrowElement(element)) {
      updateElementCoords(pointerDownState, element, scene, adjustedOffset);

      // skip arrow labels since we calculate its position during render
      const textElement = getBoundTextElement(
        element,
        scene.getNonDeletedElementsMap(),
      );
      if (textElement) {
        updateElementCoords(
          pointerDownState,
          textElement,
          scene,
          adjustedOffset,
        );
      }
      updateBoundElements(element, scene, {
        simultaneouslyUpdated: Array.from(elementsToUpdate),
      });
    } else if (
      // NOTE: Add a little initial drag to the arrow dragging when the arrow
      // is the single element being dragged to avoid accidentally unbinding
      // the arrow when the user just wants to select it.

      elementsToUpdate.size > 1 ||
      Math.max(Math.abs(adjustedOffset.x), Math.abs(adjustedOffset.y)) >
        DRAGGING_THRESHOLD ||
      (!element.startBinding && !element.endBinding)
    ) {
      updateElementCoords(pointerDownState, element, scene, adjustedOffset);

      const shouldUnbindStart =
        element.startBinding && !isStartBoundElementSelected;
      const shouldUnbindEnd = element.endBinding && !isEndBoundElementSelected;
      if (shouldUnbindStart || shouldUnbindEnd) {
        // NOTE: Moving the bound arrow should unbind it, otherwise we would
        // have weird situations, like 0 lenght arrow when the user moves
        // the arrow outside a filled shape suddenly forcing the arrow start
        // and end point to jump "outside" the shape.
        if (shouldUnbindStart) {
          unbindBindingElement(element, "start", scene);
        }
        if (shouldUnbindEnd) {
          unbindBindingElement(element, "end", scene);
        }
      }
    }
  });
};

const calculateOffset = (
  commonBounds: Bounds,
  dragOffset: { x: number; y: number },
  snapOffset: { x: number; y: number },
  gridSize: NullableGridSize,
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
  element: ExcalidrawElement,
  scene: Scene,
  dragOffset: { x: number; y: number },
) => {
  const originalElement =
    pointerDownState.originalElements.get(element.id) ?? element;

  const nextX = originalElement.x + dragOffset.x;
  const nextY = originalElement.y + dragOffset.y;

  scene.mutateElement(element, {
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

/**
 * Sizes a text element as it is dragged out.
 *
 * A dragged text pins one point and grows away from it; `anchorRatio` says
 * where along the box that point sits — 0 for its left edge, 1 for its right,
 * 0.5 for its centre.
 *
 * A free text pins the point the drag started from and takes the ratio from
 * the drag direction, so it can be pulled either way. A text bound to an arrow
 * endpoint instead pins whatever the binding placed it against and takes the
 * ratio from its alignment — which is also what keeps it from growing back
 * over the arrow, since dragging that way makes no progress rather than
 * flipping the box around.
 */
export const dragNewTextElement = ({
  newElement,
  anchorX,
  anchorRatio,
  pointerX,
  nextY,
  zoom,
  scene,
  informMutation = true,
}: {
  newElement: ExcalidrawTextElement;
  anchorX: number;
  /** 0 = anchored by its left edge, 1 = by its right, 0.5 = by its centre */
  anchorRatio: number;
  pointerX: number;
  /** free text re-tops itself to the drag origin; a bound one must not move */
  nextY?: number;
  zoom: NormalizedZoomValue;
  scene: Scene;
  informMutation?: boolean;
}) => {
  const offset = pointerX - anchorX;

  // how far the pointer has travelled away from the anchor along the direction
  // the box may grow — negative once it heads back the other way
  const reach =
    anchorRatio === 0 ? offset : anchorRatio === 1 ? -offset : Math.abs(offset);

  const width = Math.max(
    // a centred box grows on both sides, so it widens at twice the reach
    anchorRatio === 0.5 ? reach * 2 : reach,
    getMinTextElementWidth(
      getFontString({
        fontSize: newElement.fontSize,
        fontFamily: newElement.fontFamily,
      }),
      newElement.lineHeight,
    ),
  );

  scene.mutateElement(
    newElement,
    {
      x: anchorX - width * anchorRatio,
      ...(nextY === undefined ? {} : { y: nextY }),
      width,
      ...(reach > TEXT_AUTOWRAP_THRESHOLD / zoom ? { autoResize: false } : {}),
    },
    { informMutation, isDragging: false },
  );
};

export const dragNewElement = ({
  newElement,
  elementType,
  originX,
  originY,
  x,
  y,
  width,
  height,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  zoom,
  scene,
  widthAspectRatio = null,
  originOffset = null,
  informMutation = true,
}: {
  newElement: NonDeletedExcalidrawElement;
  elementType: AppState["activeTool"]["type"];
  originX: number;
  originY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shouldMaintainAspectRatio: boolean;
  shouldResizeFromCenter: boolean;
  zoom: NormalizedZoomValue;
  scene: Scene;
  /** whether to keep given aspect ratio when `isResizeWithSidesSameLength` is
      true */
  widthAspectRatio?: number | null;
  originOffset?: {
    x: number;
    y: number;
  } | null;
  informMutation?: boolean;
}) => {
  if (shouldMaintainAspectRatio && newElement.type !== "selection") {
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

  if (isTextElement(newElement)) {
    // a text is only ever sized horizontally — its height follows the wrapped
    // content — so it grows away from the point the drag started at
    dragNewTextElement({
      newElement,
      anchorX: originX + (originOffset?.x ?? 0),
      anchorRatio: shouldResizeFromCenter ? 0.5 : x < originX ? 1 : 0,
      pointerX: x,
      nextY: originY + (originOffset?.y ?? 0),
      zoom,
      scene,
      informMutation,
    });
    return;
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
    let imageInitialDimension = null;
    if (isImageElement(newElement)) {
      imageInitialDimension = {
        initialWidth: width,
        initialHeight: height,
      };
    }

    scene.mutateElement(
      newElement,
      {
        x: newX + (originOffset?.x ?? 0),
        y: newY + (originOffset?.y ?? 0),
        width,
        height,
        ...imageInitialDimension,
      },
      { informMutation, isDragging: false },
    );
  }
};
