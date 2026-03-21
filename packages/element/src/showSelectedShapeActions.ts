import type { UIAppState } from "@excalidraw/excalidraw/types";

import { getSelectedElements } from "./selection";

import type { NonDeletedExcalidrawElement } from "./types";

export const showSelectedShapeActions = (
  appState: UIAppState,
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
        getSelectedElements(elements, appState).length ||
        //添加按住左键拉框,可以选中文本框的功能2026.03.21
        !!Object.keys(appState.selectedTextLineLinkIds).length),
  );
