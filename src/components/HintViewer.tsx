import React from "react";
import { t } from "../i18n";
import { ExcalidrawElement } from "../element/types";
import { getSelectedElements } from "../scene";

import "./HintViewer.scss";
import { AppState } from "../types";
import { isLinearElement } from "../element/typeChecks";

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
    const targetElement = selectedElements[0];
    if (isLinearElement(targetElement) && targetElement.points.length > 2) {
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
