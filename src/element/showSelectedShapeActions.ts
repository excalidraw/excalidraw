import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "./types";
import { getSelectedElements } from "../scene";

export const showSelectedShapeActions = (
  appState: AppState,
  elements: readonly NonDeletedExcalidrawElement[],
) =>
  Boolean(
    (!appState.viewModeEnabled &&
      appState.activeTool.type !== "image" &&
      appState.activeTool.type !== "custom" &&
      (appState.editingElement ||
        (appState.activeTool.type !== "selection" &&
          appState.activeTool.type !== "eraser"))) ||
      (getSelectedElements(elements, appState).length &&
        !isOnlyImageSelected(appState, elements)),
  );

// Dont show shape actions for image
const isOnlyImageSelected = (
  appState: AppState,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const selectedElements = elements.filter(
    (el) => appState.selectedElementIds[el.id],
  );
  return selectedElements.every((el) => el.type === "image");
};
