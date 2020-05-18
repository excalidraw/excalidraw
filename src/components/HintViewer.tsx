import React from "react";
import { t } from "../i18n";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getSelectedElements } from "../scene";

import "./HintViewer.scss";
import { AppState } from "../types";
import { isLinearElement } from "../element/typeChecks";

interface Hint {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
}

const getHints = ({ appState, elements }: Hint) => {
  const { elementType, isResizing, isRotating, lastPointerDownWith } = appState;
  const multiMode = appState.multiElement !== null;
  if (elementType === "arrow" || elementType === "line") {
    if (!multiMode) {
      return t("hints.linearElement");
    }
    return t("hints.linearElementMulti");
  }

  if (elementType === "draw") {
    return t("hints.freeDraw");
  }

  const selectedElements = getSelectedElements(elements, appState);
  if (
    isResizing &&
    lastPointerDownWith === "mouse" &&
    selectedElements.length === 1
  ) {
    const targetElement = selectedElements[0];
    if (isLinearElement(targetElement) && targetElement.points.length > 2) {
      return null;
    }
    return t("hints.resize");
  }

  if (isRotating && lastPointerDownWith === "mouse") {
    return t("hints.rotate");
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
