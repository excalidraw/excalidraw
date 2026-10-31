import { getNonDeletedElements } from "@excalidraw/element";
import { mutateElement } from "@excalidraw/element";
import { newFrameElement } from "@excalidraw/element";
import {
  isBoundToContainer,
  isFrameLikeElement,
  isImageElement,
} from "@excalidraw/element";
import {
  addElementsToFrame,
  removeAllElementsFromFrame,
} from "@excalidraw/element";
import { getFrameChildren } from "@excalidraw/element";
import { fixBindingsAfterDeletion } from "@excalidraw/element";

import { getElementsInGroup } from "@excalidraw/element";

import {
  boundsContainBounds,
  getCommonBounds,
  getElementBounds,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getSelectionStateForElements } from "../components/App.selection";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { ActionResult } from "./types";
import type { AppClassProperties, AppState, UIAppState } from "../types";

const isSingleFrameSelected = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  return (
    selectedElements.length === 1 && isFrameLikeElement(selectedElements[0])
  );
};

export const actionSelectAllElementsInFrame = register({
  name: "selectAllElementsInFrame",
  label: "labels.selectAllElementsInFrame",
  trackEvent: { category: "canvas" },
  perform: (elements, appState, _, app) => {
    const selectedElement =
      app.scene.getSelectedElements(appState).at(0) || null;

    if (isFrameLikeElement(selectedElement)) {
      const elementsInFrame = getFrameChildren(
        getNonDeletedElements(elements),
        selectedElement.id,
      ).filter((element) => !(element.type === "text" && element.containerId));

      return {
        elements,
        appState: {
          ...appState,
          selectedElementIds: elementsInFrame.reduce((acc, element) => {
            acc[element.id] = true;
            return acc;
          }, {} as Record<ExcalidrawElement["id"], true>),
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
});

export const actionRemoveAllElementsFromFrame = register({
  name: "removeAllElementsFromFrame",
  label: "labels.removeAllElementsFromFrame",
  trackEvent: { category: "history" },
  perform: (elements, appState, _, app) => {
    const selectedElement =
      app.scene.getSelectedElements(appState).at(0) || null;

    if (isFrameLikeElement(selectedElement)) {
      return {
        elements: removeAllElementsFromFrame(elements, selectedElement),
        appState: {
          ...appState,
          selectedElementIds: {
            [selectedElement.id]: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
});

export const actionupdateFrameRendering = register({
  name: "updateFrameRendering",
  label: "labels.updateFrameRendering",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => {
    return {
      elements,
      appState: {
        ...appState,
        frameRendering: {
          ...appState.frameRendering,
          enabled: !appState.frameRendering.enabled,
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.frameRendering.enabled,
});

const FRAME_PADDING = 16;

/**
 * The frame that wrapping the selection removes instead: the one frame the
 * selection holds (along with any of its children), or, with no frame
 * selected, the frame whose children are all selected.
 */
export const getFrameToUnwrap = (
  selectedElements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
): ExcalidrawFrameLikeElement | null => {
  const elements = selectedElements.filter(
    (element) => !isBoundToContainer(element),
  );
  const frames = elements.filter((element) => isFrameLikeElement(element));
  if (frames.length > 1) {
    return null;
  }

  const frameId = frames[0]?.id ?? elements[0]?.frameId;
  const frame = frameId ? elementsMap.get(frameId) : null;
  if (!frame || frame.isDeleted || !isFrameLikeElement(frame)) {
    return null;
  }

  const selectedChildren = elements.filter(
    (element) => element.frameId === frame.id,
  );
  if (selectedChildren.length + frames.length !== elements.length) {
    return null;
  }
  if (frames.length) {
    return frame;
  }

  // with no frame selected, all of its children have to be
  const children = getFrameChildren(elementsMap, frame.id).filter(
    (element) => !element.isDeleted && !isBoundToContainer(element),
  );
  return children.length === selectedChildren.length ? frame : null;
};

/** removes the frame, keeping its children selected in its place */
export const unwrapFrame = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  frame: ExcalidrawFrameLikeElement,
  app: AppClassProperties,
): ActionResult => {
  const children = getNonDeletedElements(getFrameChildren(elements, frame.id));

  removeAllElementsFromFrame(elements, frame);
  app.scene.mutateElement(frame, { isDeleted: true });
  fixBindingsAfterDeletion(elements, [frame]);

  return {
    elements,
    appState: {
      ...appState,
      ...getSelectionStateForElements(
        children,
        getNonDeletedElements(elements),
        { ...appState, editingGroupId: null },
      ),
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

/** wraps the selection in a new frame — edge to edge when it's an image */
export const wrapInFrame = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  selectedElements: NonDeletedExcalidrawElement[],
  app: AppClassProperties,
): ActionResult => {
  const elementsMap = app.scene.getNonDeletedElementsMap();

  const bounds = getCommonBounds(selectedElements, elementsMap);
  // an image framed along with what's drawn on it keeps no margin
  const padding = selectedElements.some(
    (element) =>
      isImageElement(element) &&
      boundsContainBounds(getElementBounds(element, elementsMap), bounds),
  )
    ? 0
    : FRAME_PADDING;
  const [x1, y1, x2, y2] = bounds;
  const frame = newFrameElement({
    x: x1 - padding,
    y: y1 - padding,
    width: x2 - x1 + padding * 2,
    height: y2 - y1 + padding * 2,
  });

  // for a selected partial group, we want to remove it from the remainder of the group
  if (appState.editingGroupId) {
    const elementsInGroup = getElementsInGroup(
      selectedElements,
      appState.editingGroupId,
    );

    for (const elementInGroup of elementsInGroup) {
      const index = elementInGroup.groupIds.indexOf(appState.editingGroupId);

      mutateElement(elementInGroup, elementsMap, {
        groupIds: elementInGroup.groupIds.slice(0, index),
      });
    }
  }

  const nextElements = addElementsToFrame(
    [...app.scene.getElementsIncludingDeleted(), frame],
    selectedElements,
    frame,
  );

  return {
    elements: nextElements,
    appState: {
      ...appState,
      // dropping the line editor of a framed arrow
      ...getSelectionStateForElements(
        [frame],
        getNonDeletedElements(nextElements),
        appState,
      ),
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

export const actionWrapSelectionInFrame = register({
  name: "wrapSelectionInFrame",
  label: (elements, appState, app) =>
    getFrameToUnwrap(
      app.scene.getSelectedElements(appState),
      app.scene.getNonDeletedElementsMap(),
    )
      ? "labels.removeFrame"
      : "labels.wrapSelectionInFrame",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    return (
      selectedElements.length > 0 &&
      !selectedElements.some((element) => isFrameLikeElement(element))
    );
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);
    // selecting all of a frame's children unwraps them instead
    const frameToUnwrap = getFrameToUnwrap(
      selectedElements,
      app.scene.getNonDeletedElementsMap(),
    );

    return frameToUnwrap
      ? unwrapFrame(elements, appState, frameToUnwrap, app)
      : wrapInFrame(elements, appState, selectedElements, app);
  },
});
