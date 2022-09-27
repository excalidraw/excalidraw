import { getNonDeletedElements } from "../element";
import { LinearElementEditor } from "../element/linearElementEditor";
import { isLinearElement } from "../element/typeChecks";
import { ExcalidrawLinearElement } from "../element/types";
import { getSelectedElements } from "../scene";
import { register } from "./register";

export const actionToggleLinearEditor = register({
  name: "toggleLinearEditor",
  trackEvent: {
    category: "element",
  },
  contextItemPredicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
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

    const editingLinearElement =
      appState.editingLinearElement?.elementId === selectedElement.id
        ? null
        : new LinearElementEditor(selectedElement, app.scene);
    return {
      appState: {
        ...appState,
        editingLinearElement,
      },
      commitToHistory: false,
    };
  },
  contextItemLabel: (elements, appState) => {
    const selectedElement = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      true,
    )[0] as ExcalidrawLinearElement;
    return appState.editingLinearElement?.elementId === selectedElement.id
      ? "labels.lineEditor.exit"
      : "labels.lineEditor.edit";
  },
});
