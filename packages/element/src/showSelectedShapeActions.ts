import type { UIAppState } from "@excalidraw/excalidraw/types";

import type { NonDeletedExcalidrawElement } from "./types";

export const showSelectedShapeActions = (
  appState: UIAppState,
  _elements: readonly NonDeletedExcalidrawElement[],
) => Boolean(appState.openDialog?.name !== "elementLinkSelector");
