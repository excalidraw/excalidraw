import { t } from "../i18n";
import type { AppClassProperties, Device, UIAppState } from "../types";
import {
  isImageElement,
  isLinearElement,
  isTextBindableContainer,
  isTextElement,
} from "../element/typeChecks";
import { getShortcutKey } from "../utils";
import { isEraserActive } from "../appState";

import "./HintViewer.scss";

interface HintViewerProps {
  appState: UIAppState;
  isMobile: boolean;
  device: Device;
  app: AppClassProperties;
}

const getHints = ({ appState, isMobile, device, app }: HintViewerProps) => {
  const { activeTool, isResizing, isRotating, lastPointerDownWith } = appState;
  const multiMode = appState.multiElement !== null;

  if (appState.openSidebar && !device.editor.canFitSidebar) {
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

  if (activeTool.type === "embeddable") {
    return t("hints.embeddable");
  }

  if (appState.activeTool.type === "image" && appState.pendingImageElementId) {
    return t("hints.placeImage");
  }

  const selectedElements = app.scene.getSelectedElements(appState);

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
      !selectedElements.length &&
      !appState.editingElement &&
      !appState.editingLinearElement
    ) {
      return t("hints.deepBoxSelect");
    }

    if (appState.gridSize && appState.draggingElement) {
      return t("hints.disableSnapping");
    }

    if (!selectedElements.length && !isMobile) {
      return t("hints.canvasPanning");
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
      if (
        !appState.draggingElement &&
        isTextBindableContainer(selectedElements[0])
      ) {
        return t("hints.bindTextToElement");
      }
    }
  }

  return null;
};

export const HintViewer = ({
  appState,
  isMobile,
  device,
  app,
}: HintViewerProps) => {
  let hint = getHints({
    appState,
    isMobile,
    device,
    app,
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
