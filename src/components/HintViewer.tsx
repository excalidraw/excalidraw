import { t } from "../i18n";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getSelectedElements } from "../scene";

import "./HintViewer.scss";
import { AppState } from "../types";
import {
  isImageElement,
  isLinearElement,
  isTextBindableContainer,
  isTextElement,
} from "../element/typeChecks";
import { getShortcutKey } from "../utils";

interface HintViewerProps {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  isMobile: boolean;
}

const getHints = ({ appState, elements, isMobile }: HintViewerProps) => {
  const { elementType, isResizing, isRotating, lastPointerDownWith } = appState;
  const multiMode = appState.multiElement !== null;

  if (elementType === "arrow" || elementType === "line") {
    if (!multiMode) {
      return t("hints.linearElement");
    }
    return t("hints.linearElementMulti");
  }

  if (elementType === "freedraw") {
    return t("hints.freeDraw");
  }

  if (elementType === "text") {
    return t("hints.text");
  }

  if (appState.elementType === "image" && appState.pendingImageElement) {
    return t("hints.placeImage");
  }

  const selectedElements = getSelectedElements(elements, appState);

  if (
    isResizing &&
    lastPointerDownWith === "mouse" &&
    selectedElements.length === 1
  ) {
    const targetElement = selectedElements[0];
    if (isLinearElement(targetElement) && targetElement.points.length === 2) {
      return t("hints.lockAngle");
    }
    return isImageElement(targetElement)
      ? t("hints.resizeImage")
      : t("hints.resize");
  }

  if (isRotating && lastPointerDownWith === "mouse") {
    return t("hints.rotate");
  }

  if (selectedElements.length === 1 && isTextElement(selectedElements[0])) {
    return t("hints.text_selected");
  }

  if (appState.editingElement && isTextElement(appState.editingElement)) {
    return t("hints.text_editing");
  }

  if (elementType === "selection") {
    if (
      appState.draggingElement?.type === "selection" &&
      !appState.editingElement &&
      !appState.editingLinearElement
    ) {
      return t("hints.deepBoxSelect");
    }
    if (!selectedElements.length && !isMobile) {
      return t("hints.canvasPanning");
    }
  }

  if (selectedElements.length === 1) {
    if (isLinearElement(selectedElements[0])) {
      if (appState.editingLinearElement) {
        return appState.editingLinearElement.selectedPointsIndices
          ? t("hints.lineEditor_pointSelected")
          : t("hints.lineEditor_nothingSelected");
      }
      return t("hints.lineEditor_info");
    }
    if (isTextBindableContainer(selectedElements[0])) {
      return t("hints.bindTextToElement");
    }
  }

  return null;
};

export const HintViewer = ({
  appState,
  elements,
  isMobile,
}: HintViewerProps) => {
  let hint = getHints({
    appState,
    elements,
    isMobile,
  });
  if (!hint) {
    return null;
  }

  hint = getShortcutKey(hint);

  return (
    <div className="HintViewer">
      <span>{hint}</span>
    </div>
  );
};
