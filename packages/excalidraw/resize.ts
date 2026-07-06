import {
  getGridPoint,
  KEYS,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  cropElement,
  getElementsInResizingFrame,
  getFrameChildren,
  getSelectedElements,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isInitializedImageElement,
  transformElements,
  updateBoundElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

import {
  getReferenceSnapPoints,
  isSnappingEnabled,
  SnapCache,
  snapResizingElements,
} from "./snapping";

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
