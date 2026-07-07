import {
  getGridPoint,
  KEYS,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  cropElement,
  getCommonBounds,
  getCursorForResizingElement,
  getElementAbsoluteCoords,
  getElementsInResizingFrame,
  getElementWithTransformHandleType,
  getFrameChildren,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getSelectedElements,
  getTransformHandleTypeFromCoords,
  getUncroppedWidthAndHeight,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isInitializedImageElement,
  isInvisiblySmallElement,
  isLinearElement,
  replaceAllElementsInFrame,
  transformElements,
  updateBoundElements,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";
import {
  clamp,
  pointFrom,
  pointRotateRads,
  vector,
  vectorDot,
  vectorFromPoint,
  vectorNormalize,
  vectorSubtract,
} from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { setCursor } from "./cursor";
import {
  getReferenceSnapPoints,
  isSnappingEnabled,
  SnapCache,
  snapResizingElements,
} from "./snapping";

import type React from "react";

import type { App, AppState, PointerDownState } from "./types";

const maybeHandleCrop = (
  app: App,
  state: AppState,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  // to crop, we must already be in the cropping mode, where croppingElement has been set
  if (!state.croppingElementId) {
    return false;
  }

  const transformHandleType = pointerDownState.resize.handleType;
  const pointerCoords = pointerDownState.lastCoords;
  const [x, y] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
  );

  const croppingElement = app.scene
    .getNonDeletedElementsMap()
    .get(state.croppingElementId);

  if (
    transformHandleType &&
    croppingElement &&
    isImageElement(croppingElement)
  ) {
    const croppingAtStateStart = pointerDownState.originalElements.get(
      croppingElement.id,
    );

    const image =
      isInitializedImageElement(croppingElement) &&
      app.imageCache.get(croppingElement.fileId)?.image;

    if (
      croppingAtStateStart &&
      isImageElement(croppingAtStateStart) &&
      image &&
      !(image instanceof Promise)
    ) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
      );

      const dragOffset = {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      };

      if (
        isSnappingEnabled({
          event,
          app,
          selectedElements: [croppingElement],
        }) &&
        !SnapCache.getReferenceSnapPoints()
      ) {
        SnapCache.setReferenceSnapPoints(
          getReferenceSnapPoints(
            app.scene.getNonDeletedElements(),
            [croppingElement],
            app.state,
            app.scene.getNonDeletedElementsMap(),
          ),
        );
      }

      const { snapOffset, snapLines } = snapResizingElements(
        [croppingElement],
        [croppingAtStateStart],
        app,
        event,
        dragOffset,
        transformHandleType,
      );

      app.scene.mutateElement(
        croppingElement,
        cropElement(
          croppingElement,
          app.scene.getNonDeletedElementsMap(),
          transformHandleType,
          image.naturalWidth,
          image.naturalHeight,
          x + snapOffset.x,
          y + snapOffset.y,
          event.shiftKey
            ? croppingAtStateStart.width / croppingAtStateStart.height
            : undefined,
        ),
      );

      updateBoundElements(croppingElement, app.scene);

      app.setState({
        isCropping: transformHandleType && transformHandleType !== "rotation",
        snapLines,
      });
    }

    return true;
  }

  return false;
};

const maybeHandleResize = (
  app: App,
  pointerDownState: PointerDownState,
  event: MouseEvent | KeyboardEvent,
): boolean => {
  const selectedElements = app.scene.getSelectedElements(app.state);
  const selectedFrames = selectedElements.filter(
    (element): element is ExcalidrawFrameLikeElement =>
      isFrameLikeElement(element),
  );

  const transformHandleType = pointerDownState.resize.handleType;

  if (
    // Frames cannot be rotated.
    (selectedFrames.length > 0 && transformHandleType === "rotation") ||
    // Elbow arrows cannot be transformed (resized or rotated).
    (selectedElements.length === 1 && isElbowArrow(selectedElements[0])) ||
    // Do not resize when in crop mode
    app.state.croppingElementId
  ) {
    return false;
  }

  app.setState({
    // TODO: rename this state field to "isScaling" to distinguish
    // it from the generic "isResizing" which includes scaling and
    // rotating
    isResizing: transformHandleType && transformHandleType !== "rotation",
    isRotating: transformHandleType === "rotation",
    activeEmbeddable: null,
  });
  const pointerCoords = pointerDownState.lastCoords;
  let [resizeX, resizeY] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
  );

  const frameElementsOffsetsMap = new Map<
    string,
    {
      x: number;
      y: number;
    }
  >();

  selectedFrames.forEach((frame) => {
    const elementsInFrame = getFrameChildren(
      app.scene.getNonDeletedElements(),
      frame.id,
    );

    elementsInFrame.forEach((element) => {
      frameElementsOffsetsMap.set(frame.id + element.id, {
        x: element.x - frame.x,
        y: element.y - frame.y,
      });
    });
  });

  // check needed for avoiding flickering when a key gets pressed
  // during dragging
  if (!app.state.selectedElementsAreBeingDragged) {
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
    );

    const dragOffset = {
      x: gridX - pointerDownState.originInGrid.x,
      y: gridY - pointerDownState.originInGrid.y,
    };

    const originalElements = [...pointerDownState.originalElements.values()];

    if (
      isSnappingEnabled({
        event,
        app,
        selectedElements,
      }) &&
      !SnapCache.getReferenceSnapPoints()
    ) {
      SnapCache.setReferenceSnapPoints(
        getReferenceSnapPoints(
          app.scene.getNonDeletedElements(),
          selectedElements,
          app.state,
          app.scene.getNonDeletedElementsMap(),
        ),
      );
    }

    const { snapOffset, snapLines } = snapResizingElements(
      selectedElements,
      getSelectedElements(originalElements, app.state),
      app,
      event,
      dragOffset,
      transformHandleType,
    );

    resizeX += snapOffset.x;
    resizeY += snapOffset.y;

    app.setState({
      snapLines,
    });
  }

  if (
    transformElements(
      pointerDownState.originalElements,
      transformHandleType,
      selectedElements,
      app.scene,
      shouldRotateWithDiscreteAngle(event),
      shouldResizeFromCenter(event),
      selectedElements.some((element) => isImageElement(element))
        ? !shouldMaintainAspectRatio(event)
        : shouldMaintainAspectRatio(event),
      resizeX,
      resizeY,
      pointerDownState.resize.center.x,
      pointerDownState.resize.center.y,
    )
  ) {
    const elementsToHighlight = new Set<ExcalidrawElement>();
    selectedFrames.forEach((frame) => {
      getElementsInResizingFrame(
        app.scene.getNonDeletedElements(),
        frame,
        app.state,
        app.scene.getNonDeletedElementsMap(),
      ).forEach((element) => elementsToHighlight.add(element));
    });

    app.setState({
      elementsToHighlight: [...elementsToHighlight],
    });

    return true;
  }
  return false;
};

export const resizePointerMoveFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): boolean => {
  if (pointerDownState.resize.isResizing) {
    const pointerCoords = viewportCoordsToSceneCoords(event, app.state);

    pointerDownState.lastCoords.x = pointerCoords.x;
    pointerDownState.lastCoords.y = pointerCoords.y;
    if (maybeHandleCrop(app, app.state, pointerDownState, event)) {
      return true;
    }
    if (maybeHandleResize(app, pointerDownState, event)) {
      return true;
    }
  }

  return false;
};

export const resizeOnKeyDownFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  event: KeyboardEvent,
): boolean => {
  if (maybeHandleResize(app, pointerDownState, event)) {
    return true;
  }

  return false;
};

export const resizeKeyUpFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  event: KeyboardEvent,
): boolean => {
  if (maybeHandleResize(app, pointerDownState, event)) {
    return true;
  }

  return false;
};

/**
 * Detects a transform handle (resize/rotate) hit on pointer down and, if hit,
 * primes `pointerDownState.resize`.
 *
 * @returns whether a transform handle was grabbed (i.e. resizing/rotating
 * should take over the pointer interaction).
 */
export const resizeSetupOnPointerDownHandler = (
  app: App,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): boolean => {
  const elements = app.scene.getNonDeletedElements();
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const selectedElements = app.scene.getSelectedElements(app.state);

  if (
    selectedElements.length === 1 &&
    !app.state.selectedLinearElement?.isEditing &&
    !isElbowArrow(selectedElements[0]) &&
    !(
      isLinearElement(selectedElements[0]) &&
      (app.editorInterface.userAgent.isMobileDevice ||
        selectedElements[0].points.length === 2)
    ) &&
    !(
      app.state.selectedLinearElement &&
      app.state.selectedLinearElement.hoverPointIndex !== -1
    )
  ) {
    const elementWithTransformHandleType = getElementWithTransformHandleType(
      elements,
      app.state,
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      app.state.zoom,
      event.pointerType,
      app.scene.getNonDeletedElementsMap(),
      app.editorInterface,
    );
    if (elementWithTransformHandleType != null) {
      if (elementWithTransformHandleType.transformHandleType === "rotation") {
        app.setState({
          resizingElement: elementWithTransformHandleType.element,
        });
        pointerDownState.resize.handleType =
          elementWithTransformHandleType.transformHandleType;
      } else if (app.state.croppingElementId) {
        pointerDownState.resize.handleType =
          elementWithTransformHandleType.transformHandleType;
      } else {
        app.setState({
          resizingElement: elementWithTransformHandleType.element,
        });
        pointerDownState.resize.handleType =
          elementWithTransformHandleType.transformHandleType;
      }
    }
  } else if (selectedElements.length > 1) {
    pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
      getCommonBounds(selectedElements),
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      app.state.zoom,
      event.pointerType,
      app.editorInterface,
    );
  }
  if (pointerDownState.resize.handleType) {
    pointerDownState.resize.isResizing = true;
    pointerDownState.resize.offset = tupleToCoors(
      getResizeOffsetXY(
        pointerDownState.resize.handleType,
        selectedElements,
        elementsMap,
        pointerDownState.origin.x,
        pointerDownState.origin.y,
      ),
    );
    if (
      selectedElements.length === 1 &&
      isLinearElement(selectedElements[0]) &&
      selectedElements[0].points.length === 2
    ) {
      pointerDownState.resize.arrowDirection = getResizeArrowDirection(
        pointerDownState.resize.handleType,
        selectedElements[0],
      );
    }
    return true;
  }
  return false;
};

/**
 * Finalizes a resize interaction on pointer up: drops invisibly-small resized
 * elements from the store snapshot and updates frame membership for any resized
 * frames.
 *
 * `resizingElement` must be captured from state *before* it is reset on pointer
 * up, and `elementsMap` is the pointer-up-time non-deleted elements map.
 */
export const resizeOnPointerUpFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  resizingElement: NonDeletedExcalidrawElement | null,
  elementsMap: NonDeletedSceneElementsMap,
): void => {
  if (resizingElement && isInvisiblySmallElement(resizingElement)) {
    // update the store snapshot, so that invisible elements are not captured by the store
    app.updateScene({
      elements: app.scene
        .getElementsIncludingDeleted()
        .filter((el) => el.id !== resizingElement.id),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  // handle frame membership for resizing frames and/or selected elements
  if (pointerDownState.resize.isResizing) {
    let nextElements = updateFrameMembershipOfSelectedElements(
      app.scene.getElementsIncludingDeleted(),
      app.state,
      app,
    );

    const selectedFrames = app.scene
      .getSelectedElements(app.state)
      .filter((element): element is ExcalidrawFrameLikeElement =>
        isFrameLikeElement(element),
      );

    for (const frame of selectedFrames) {
      nextElements = replaceAllElementsInFrame(
        nextElements,
        getElementsInResizingFrame(
          app.scene.getElementsIncludingDeleted(),
          frame,
          app.state,
          elementsMap,
        ),
        frame,
      );
    }

    app.scene.replaceAllElements(nextElements);
  }
};

/**
 * On pointer move (hover), sets the resize/rotate cursor if the pointer is over
 * a transform handle of the current selection.
 *
 * @returns whether a resize cursor was set (in which case the caller should stop
 * further cursor handling).
 */
export const setResizeCursorOnPointerMove = (
  app: App,
  event: React.PointerEvent<HTMLCanvasElement>,
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElements: readonly NonDeletedExcalidrawElement[],
  scenePointerX: number,
  scenePointerY: number,
  isOverScrollBar: boolean,
): boolean => {
  if (
    selectedElements.length === 1 &&
    !isOverScrollBar &&
    !app.state.selectedLinearElement?.isEditing
  ) {
    // for linear elements, we'd like to prioritize point dragging over edge resizing
    // therefore, we update and check hovered point index first
    if (app.state.selectedLinearElement) {
      app.handleHoverSelectedLinearElement(
        app.state.selectedLinearElement,
        scenePointerX,
        scenePointerY,
      );
    }

    if (
      (!app.state.selectedLinearElement ||
        app.state.selectedLinearElement.hoverPointIndex === -1) &&
      app.state.openDialog?.name !== "elementLinkSelector" &&
      !(selectedElements.length === 1 && isElbowArrow(selectedElements[0])) &&
      // HACK: Disable transform handles for linear elements on mobile until a
      // better way of showing them is found
      !(
        isLinearElement(selectedElements[0]) &&
        (app.editorInterface.userAgent.isMobileDevice ||
          selectedElements[0].points.length === 2)
      )
    ) {
      const elementWithTransformHandleType = getElementWithTransformHandleType(
        elements,
        app.state,
        scenePointerX,
        scenePointerY,
        app.state.zoom,
        event.pointerType,
        app.scene.getNonDeletedElementsMap(),
        app.editorInterface,
      );
      if (
        elementWithTransformHandleType &&
        elementWithTransformHandleType.transformHandleType
      ) {
        setCursor(
          app.interactiveCanvas,
          getCursorForResizingElement(elementWithTransformHandleType),
        );
        return true;
      }
    }
  } else if (
    selectedElements.length > 1 &&
    !isOverScrollBar &&
    app.state.openDialog?.name !== "elementLinkSelector"
  ) {
    const transformHandleType = getTransformHandleTypeFromCoords(
      getCommonBounds(selectedElements),
      scenePointerX,
      scenePointerY,
      app.state.zoom,
      event.pointerType,
      app.editorInterface,
    );
    if (transformHandleType) {
      setCursor(
        app.interactiveCanvas,
        getCursorForResizingElement({
          transformHandleType,
        }),
      );
      return true;
    }
  }

  return false;
};

/**
 * While dragging inside a cropping image, pans the crop region instead of
 * moving the element.
 *
 * @returns whether the crop region was moved (in which case the caller should
 * stop further drag handling).
 */
export const maybeMoveCropRegion = (
  app: App,
  pointerDownState: PointerDownState,
  pointerCoords: { x: number; y: number },
  lastPointerCoords: { x: number; y: number },
  elementsMap: NonDeletedSceneElementsMap,
): boolean => {
  if (app.state.croppingElementId) {
    const croppingElement = app.scene
      .getNonDeletedElementsMap()
      .get(app.state.croppingElementId);

    if (
      croppingElement &&
      isImageElement(croppingElement) &&
      croppingElement.crop !== null &&
      pointerDownState.hit.element === croppingElement
    ) {
      const crop = croppingElement.crop;
      const image =
        isInitializedImageElement(croppingElement) &&
        app.imageCache.get(croppingElement.fileId)?.image;

      if (image && !(image instanceof Promise)) {
        const uncroppedSize = getUncroppedWidthAndHeight(croppingElement);
        const instantDragOffset = vector(
          pointerCoords.x - lastPointerCoords.x,
          pointerCoords.y - lastPointerCoords.y,
        );

        // to reduce cursor:image drift, we need to take into account
        // the canvas image element scaling so we can accurately
        // track the pixels on movement
        instantDragOffset[0] *= image.naturalWidth / uncroppedSize.width;
        instantDragOffset[1] *= image.naturalHeight / uncroppedSize.height;

        const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
          croppingElement,
          elementsMap,
        );

        const topLeft = vectorFromPoint(
          pointRotateRads(
            pointFrom(x1, y1),
            pointFrom(cx, cy),
            croppingElement.angle,
          ),
        );
        const topRight = vectorFromPoint(
          pointRotateRads(
            pointFrom(x2, y1),
            pointFrom(cx, cy),
            croppingElement.angle,
          ),
        );
        const bottomLeft = vectorFromPoint(
          pointRotateRads(
            pointFrom(x1, y2),
            pointFrom(cx, cy),
            croppingElement.angle,
          ),
        );
        const topEdge = vectorNormalize(vectorSubtract(topRight, topLeft));
        const leftEdge = vectorNormalize(vectorSubtract(bottomLeft, topLeft));

        // project instantDrafOffset onto leftEdge and topEdge to decompose
        const offsetVector = vector(
          vectorDot(instantDragOffset, topEdge),
          vectorDot(instantDragOffset, leftEdge),
        );

        const nextCrop = {
          ...crop,
          x: clamp(
            crop.x - offsetVector[0] * Math.sign(croppingElement.scale[0]),
            0,
            image.naturalWidth - crop.width,
          ),
          y: clamp(
            crop.y - offsetVector[1] * Math.sign(croppingElement.scale[1]),
            0,
            image.naturalHeight - crop.height,
          ),
        };

        app.scene.mutateElement(croppingElement, {
          crop: nextCrop,
        });

        return true;
      }
    }
  }

  return false;
};
