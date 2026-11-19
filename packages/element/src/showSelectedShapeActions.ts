import { getSelectedElements } from "./selection";

import type { NonDeletedExcalidrawElement } from "./types";
import type { ElementsState } from "./types";

export const showSelectedShapeActions = (
  appState: Pick<
    ElementsState,
    | "viewModeEnabled"
    | "openDialog"
    | "activeTool"
    | "editingTextElement"
    | "selectedElementIds"
  >,
  elements: readonly NonDeletedExcalidrawElement[],
) =>
  Boolean(
    !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector" &&
      ((appState.activeTool.type !== "custom" &&
        (appState.editingTextElement ||
          (appState.activeTool.type !== "selection" &&
            appState.activeTool.type !== "lasso" &&
            appState.activeTool.type !== "eraser" &&
            appState.activeTool.type !== "hand" &&
            appState.activeTool.type !== "laser"))) ||
        getSelectedElements(elements, appState).length),
  );
