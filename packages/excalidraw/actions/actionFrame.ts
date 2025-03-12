import { frameToolIcon } from "../components/icons";
import { setCursorForShape } from "../cursor";
import { getCommonBounds, getNonDeletedElements } from "../element";
import { mutateElement } from "../element/mutateElement";
import { newFrameElement } from "../element/newElement";
import { isFrameLikeElement } from "../element/typeChecks";
import { addElementsToFrame, removeAllElementsFromFrame } from "../frame";
import { getFrameChildren } from "../frame";
import { getElementsInGroup } from "../groups";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { CaptureUpdateAction } from "../store";
import { updateActiveTool } from "../utils";

import { register } from "./register";

import type { ExcalidrawElement } from "../element/types";
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
  checked: (appState: AppState) => appState.frameRendering.enabled,
});

export const actionSetFrameAsActiveTool = register({
  name: "setFrameAsActiveTool",
  label: "toolBar.frame",
  trackEvent: { category: "toolbar" },
  icon: frameToolIcon,
  viewMode: false,
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "frame",
    });

    setCursorForShape(app.interactiveCanvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "frame",
        }),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLocaleLowerCase() === KEYS.F,
});

export const actionWrapSelectionInFrame = register({
  name: "wrapSelectionInFrame",
  label: "labels.wrapSelectionInFrame",
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

    const [x1, y1, x2, y2] = getCommonBounds(
      selectedElements,
      app.scene.getNonDeletedElementsMap(),
    );
    const PADDING = 16;
    const frame = newFrameElement({
      x: x1 - PADDING,
      y: y1 - PADDING,
      width: x2 - x1 + PADDING * 2,
      height: y2 - y1 + PADDING * 2,
    });

    // for a selected partial group, we want to remove it from the remainder of the group
    if (appState.editingGroupId) {
      const elementsInGroup = getElementsInGroup(
        selectedElements,
        appState.editingGroupId,
      );

      for (const elementInGroup of elementsInGroup) {
        const index = elementInGroup.groupIds.indexOf(appState.editingGroupId);

        mutateElement(
          elementInGroup,
          {
            groupIds: elementInGroup.groupIds.slice(0, index),
          },
          false,
        );
      }
    }

    const nextElements = addElementsToFrame(
      [...app.scene.getElementsIncludingDeleted(), frame],
      selectedElements,
      frame,
      appState,
    );

    return {
      elements: nextElements,
      appState: {
        selectedElementIds: { [frame.id]: true },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
