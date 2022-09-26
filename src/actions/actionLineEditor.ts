import { getNonDeletedElements } from "../element";
import { LinearElementEditor } from "../element/linearElementEditor";
import { isLinearElement } from "../element/typeChecks";
import { ExcalidrawLinearElement } from "../element/types";
import { getSelectedElements } from "../scene";
import { register } from "./register";

export const actionEnterLineEditor = register({
  name: "enterLineEditor",
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.zenModeEnabled,
  },
  contextItemPredicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    if (
      selectedElements.length === 1 &&
      isLinearElement(selectedElements[0]) &&
      appState.editingLinearElement?.elementId !== selectedElements[0].id
    ) {
      return true;
    }
    return false;
  },
  perform(elements, appState, _, app) {
    const selectedElement = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      true,
    )[0] as ExcalidrawLinearElement;
    return {
      appState: {
        ...appState,
        editingLinearElement: new LinearElementEditor(
          selectedElement,
          app.scene,
        ),
      },
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.lineEditor.edit",
});

export const actionExitLineEditor = register({
  name: "exitLineEditor",
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.zenModeEnabled,
  },
  contextItemPredicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    if (
      appState.editingLinearElement &&
      selectedElements.length === 1 &&
      isLinearElement(selectedElements[0]) &&
      appState.editingLinearElement.elementId === selectedElements[0].id
    ) {
      return true;
    }
    return false;
  },
  perform(elements, appState, _, app) {
    return {
      appState: {
        ...appState,
        editingLinearElement: null,
      },
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.lineEditor.exit",
});
