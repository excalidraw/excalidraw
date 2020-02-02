import React from "react";
import { t } from "../i18n";
import { ExcalidrawElement } from "../element/types";

import "./HintViewer.css";

interface Hint {
  elementType: string;
  multiMode: boolean;
  resizingElements: ExcalidrawElement[];
}

const getHints = ({ elementType, multiMode, resizingElements }: Hint) => {
  if (elementType === "arrow" || elementType === "line") {
    if (!multiMode) {
      return t("hints.linearElement");
    } else {
      return t("hints.linearElementMulti");
    }
  }

  if (resizingElements.length === 1) {
    const resizingElement = resizingElements[0];
    if (
      ((resizingElement.type === "arrow" || resizingElement.type === "line") &&
        resizingElement.points.length > 2) ||
      resizingElement.type === "text"
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
  resizingElements,
}: Hint) => {
  const hint = getHints({ elementType, multiMode, resizingElements });
  if (!hint) return null;

  return <div className="HintViewer">{hint}</div>;
};
