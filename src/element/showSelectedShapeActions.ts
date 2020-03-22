import { AppState } from "../types";
import { ExcalidrawElement, NonDeleted } from "./types";
import { getSelectedElements } from "../scene";

export const showSelectedShapeActions = (
  appState: AppState,
  elements: readonly NonDeleted<ExcalidrawElement>[],
) =>
  Boolean(
    appState.editingElement ||
      getSelectedElements(elements, appState).length ||
      appState.elementType !== "selection",
  );
