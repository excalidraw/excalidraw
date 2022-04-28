import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "./types";
import { getSelectedElements } from "../scene";

export const showSelectedShapeActions = (
  appState: AppState,
  elements: readonly NonDeletedExcalidrawElement[],
): boolean => {
  const selectedElements = getSelectedElements(elements, appState);
  if (selectedElements.length === 1 && selectedElements[0].type === "comment") {
    return false;
  }
  return (
    !appState.viewModeEnabled &&
    (appState.editingElement !== null ||
      selectedElements.length > 0 ||
      (appState.activeTool.type !== "selection" &&
        appState.activeTool.type !== "eraser" &&
        appState.activeTool.type !== "comment"))
  );
};
