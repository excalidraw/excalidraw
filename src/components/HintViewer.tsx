import { t } from "../i18n";
import { NonDeletedExcalidrawElement } from "../element/types";
import { getSelectedElements } from "../scene";

import "./HintViewer.scss";
import { AppState, Device } from "../types";
import {
  isImageElement,
  isLinearElement,
  isTextBindableContainer,
  isTextElement,
} from "../element/typeChecks";
import { getShortcutKey } from "../utils";
import { isEraserActive } from "../appState";

interface HintViewerProps {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
  isMobile: boolean;
  device: Device;
}

const getHints = ({
  appState,
  elements,
  isMobile,
  device,
}: HintViewerProps) => {
  const { activeTool, isResizing, isRotating, lastPointerDownWith } = appState;
  const multiMode = appState.multiElement !== null;

  if (appState.openSidebar === "library" && !device.canDeviceFitSidebar) {
    return null;
  }

  if (isEraserActive(appState)) {
    return t("hints.eraserRevert");
  }
  if (activeTool.type === "arrow" || activeTool.type === "line") {
    if (!multiMode) {
      return t("hints.linearElement");
    }
    return t("hints.linearElementMulti");
  }

  if (activeTool.type === "freedraw") {
    return t("hints.freeDraw");
  }

  if (activeTool.type === "text") {
    return t("hints.text");
  }

  if (appState.activeTool.type === "image" && appState.pendingImageElementId) {
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

  if (activeTool.type === "selection") {
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
  device,
}: HintViewerProps) => {
  let hint = getHints({
    appState,
    elements,
    isMobile,
    device,
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
