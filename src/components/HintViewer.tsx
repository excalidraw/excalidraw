import React from "react";
import { t } from "../i18n";
import { ExcalidrawElement } from "../element/types";
import { getSelectedElements } from "../scene";

import "./HintViewer.scss";
import { AppState } from "../types";

interface Hint {
  appState: AppState;
  elements: readonly ExcalidrawElement[];
}

const getHints = ({ appState, elements }: Hint) => {
  const { elementType, isResizing } = appState;
  const multiMode = appState.multiElement !== null;
  if (elementType === "arrow" || elementType === "line") {
    if (!multiMode) {
      return t("hints.linearElement");
    }
    return t("hints.linearElementMulti");
  }

  if (isResizing) {
    const selectedElements = getSelectedElements(elements, appState);
    if (
      selectedElements.length === 1 &&
      (selectedElements[0].type === "arrow" ||
        selectedElements[0].type === "line") &&
      selectedElements[0].points.length > 2
    ) {
      return null;
    }
    return t("hints.resize");
  }

  return null;
};

export const HintViewer = ({ appState, elements }: Hint) => {
  const hint = getHints({
    appState,
    elements,
  });
  if (!hint) {
    return null;
  }

  return (
    <div className="HintViewer">
      <span>{hint}</span>
    </div>
  );
};
