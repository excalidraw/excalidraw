import { getNonDeletedElements } from "../element";
import type { ExcalidrawElement } from "../element/types";
import { removeAllElementsFromFrame } from "../frame";
import { getFrameChildren } from "../frame";
import { KEYS } from "../keys";
import type { AppClassProperties, AppState, UIAppState } from "../types";
import { updateActiveTool } from "../utils";
import { setCursorForShape } from "../cursor";
import { register } from "./register";
import { isFrameLikeElement } from "../element/typeChecks";
import { frameToolIcon } from "../components/icons";
import { StoreAction } from "../store";

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
        storeAction: StoreAction.CAPTURE,
      };
    }

    return {
      elements,
      appState,
      storeAction: StoreAction.NONE,
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
        storeAction: StoreAction.CAPTURE,
      };
    }

    return {
      elements,
      appState,
      storeAction: StoreAction.NONE,
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
      storeAction: StoreAction.NONE,
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
      storeAction: StoreAction.NONE,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLocaleLowerCase() === KEYS.F,
});
