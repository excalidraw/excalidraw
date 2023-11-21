import { LinearElementEditor } from "../element/linearElementEditor";
import { isLinearElement } from "../element/typeChecks";
import { ExcalidrawLinearElement } from "../element/types";
import { register } from "./register";
import { StoreAction } from "./types";

export const actionToggleLinearEditor = register({
  name: "toggleLinearEditor",
  trackEvent: {
    category: "element",
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
      return true;
    }
    return false;
  },
  perform(elements, appState, _, app) {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    })[0] as ExcalidrawLinearElement;

    const editingLinearElement =
      appState.editingLinearElement?.elementId === selectedElement.id
        ? null
        : new LinearElementEditor(selectedElement, app.scene);
    return {
      appState: {
        ...appState,
        editingLinearElement,
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  contextItemLabel: (elements, appState, app) => {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    })[0] as ExcalidrawLinearElement;
    return appState.editingLinearElement?.elementId === selectedElement.id
      ? "labels.lineEditor.exit"
      : "labels.lineEditor.edit";
  },
});
