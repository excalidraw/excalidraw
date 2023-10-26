import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { removeAllElementsFromFrame } from "../frame";
import { getFrameElements } from "../frame";
import { KEYS } from "../keys";
import { AppClassProperties, AppState } from "../types";
import { updateActiveTool } from "../utils";
import { setCursorForShape } from "../cursor";
import { register } from "./register";

const isSingleFrameSelected = (appState: AppState, app: AppClassProperties) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  return selectedElements.length === 1 && selectedElements[0].type === "frame";
};

export const actionSelectAllElementsInFrame = register({
  name: "selectAllElementsInFrame",
  trackEvent: { category: "canvas" },
  perform: (elements, appState, _, app) => {
    const selectedFrame = app.scene.getSelectedElements(appState)[0];

    if (selectedFrame && selectedFrame.type === "frame") {
      const elementsInFrame = getFrameElements(
        getNonDeletedElements(elements),
        selectedFrame.id,
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
        commitToHistory: false,
      };
    }

    return {
      elements,
      appState,
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.selectAllElementsInFrame",
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
});

export const actionRemoveAllElementsFromFrame = register({
  name: "removeAllElementsFromFrame",
  trackEvent: { category: "history" },
  perform: (elements, appState, _, app) => {
    const selectedFrame = app.scene.getSelectedElements(appState)[0];

    if (selectedFrame && selectedFrame.type === "frame") {
      return {
        elements: removeAllElementsFromFrame(elements, selectedFrame, appState),
        appState: {
          ...appState,
          selectedElementIds: {
            [selectedFrame.id]: true,
          },
        },
        commitToHistory: true,
      };
    }

    return {
      elements,
      appState,
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.removeAllElementsFromFrame",
  predicate: (elements, appState, _, app) =>
    isSingleFrameSelected(appState, app),
});

export const actionupdateFrameRendering = register({
  name: "updateFrameRendering",
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
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.updateFrameRendering",
  checked: (appState: AppState) => appState.frameRendering.enabled,
});

export const actionSetFrameAsActiveTool = register({
  name: "setFrameAsActiveTool",
  trackEvent: { category: "toolbar" },
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
      commitToHistory: false,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLocaleLowerCase() === KEYS.F,
});
