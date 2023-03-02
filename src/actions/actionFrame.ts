import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { getElementsInFrame } from "../frame";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";
import { register } from "./register";

const enableFrameAction = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );

  return selectedElements.length === 1 && selectedElements[0].type === "frame";
};

export const actionSelectAllElementsInFrame = register({
  name: "selectAllElementsInFrame",
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => {
    const selectedFrame = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    )[0];

    if (selectedFrame && selectedFrame.type === "frame") {
      const elementsInFrame = getElementsInFrame(
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
  predicate: (elements, appState) => enableFrameAction(elements, appState),
});

export const actionRemoveAllElementsInFrame = register({
  name: "removeAllElementsInFrame",
  trackEvent: { category: "history" },
  perform: (elements, appState) => {
    const selectedFrame = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    )[0];

    if (selectedFrame && selectedFrame.type === "frame") {
      const elementsInFrame = new Set(
        getElementsInFrame(elements, selectedFrame.id),
      );

      return {
        elements: elements.filter((element) => !elementsInFrame.has(element)),
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
  predicate: (elements, appState) => enableFrameAction(elements, appState),
});
