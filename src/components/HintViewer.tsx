import React from "react";
import { t } from "../i18n";
import { ExcalidrawElement } from "../element/types";
import { getSelectedElements } from "../scene";

import "./HintViewer.css";

interface Hint {
  elementType: string;
  multiMode: boolean;
  isResizing: boolean;
  elements: readonly ExcalidrawElement[];
}

const getHints = ({ elementType, multiMode, isResizing, elements }: Hint) => {
  if (elementType === "arrow" || elementType === "line") {
    if (!multiMode) {
      return t("hints.linearElement");
    }
    return t("hints.linearElementMulti");
  }

  if (isResizing) {
    const selectedElements = getSelectedElements(elements);
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

export const HintViewer = ({
  elementType,
  multiMode,
  isResizing,
  elements,
}: Hint) => {
  const hint = getHints({
    elementType,
    multiMode,
    isResizing,
    elements,
  });
  if (!hint) {
    return null;
  }

  return <div className="HintViewer">{hint}</div>;
};
