import { isEmbeddableElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { UIAppState } from "../../types";

/** Groups share their members' existing links, without introducing a new URL
 * that overrides individual links or changes the scene format. */
export const canEditHyperlink = (
  selectedElements: readonly ExcalidrawElement[],
  appState: Pick<UIAppState, "selectedGroupIds">,
) => {
  if (selectedElements.length === 1) {
    return true;
  }
  if (selectedElements.length < 2) {
    return false;
  }

  const selectedGroupIds = Object.keys(appState.selectedGroupIds).filter(
    (id) => appState.selectedGroupIds[id],
  );
  if (selectedGroupIds.length !== 1) {
    return false;
  }

  const link = selectedElements[0].link || null;
  return selectedElements.every(
    (element) =>
      element.groupIds.includes(selectedGroupIds[0]) &&
      !element.locked &&
      !isEmbeddableElement(element) &&
      (element.link || null) === link,
  );
};
