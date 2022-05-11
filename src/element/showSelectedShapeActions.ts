import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "./types";
import { getSelectedElements } from "../scene";

export const showSelectedShapeActions = (
  appState: AppState,
  elements: readonly NonDeletedExcalidrawElement[],
) =>
  Boolean(
    (!appState.viewModeEnabled &&
      appState.activeTool.type !== "custom" &&
      (appState.editingElement ||
        (appState.activeTool.type !== "selection" &&
          appState.activeTool.type !== "eraser"))) ||
      getSelectedElements(elements, appState).length,
  );
