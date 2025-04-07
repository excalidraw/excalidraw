import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";

import {
  isFlowchartNodeElement,
  isImageElement,
  isLinearElement,
  isTextBindableContainer,
  isTextElement,
} from "@excalidraw/element/typeChecks";

import { getShortcutKey } from "@excalidraw/common";

import { isNodeInFlowchart } from "@excalidraw/element/flowchart";

import { t } from "../i18n";
import { isEraserActive } from "../appState";
import { isGridModeEnabled } from "../snapping";

import "./HintViewer.scss";

import type { AppClassProperties, Device, UIAppState } from "../types";

interface HintViewerProps {
  appState: UIAppState;
  isMobile: boolean;
  device: Device;
  app: AppClassProperties;
}

const getHints = ({
  appState,
  isMobile,
  device,
  app,
}: HintViewerProps): null | string | string[] => {
  const { activeTool, isResizing, isRotating, lastPointerDownWith } = appState;
  const multiMode = appState.multiElement !== null;

  if (
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    appState.openSidebar.tab === CANVAS_SEARCH_TAB &&
    appState.searchMatches?.length
  ) {
    return t("hints.dismissSearch");
  }

  if (appState.openSidebar && !device.editor.canFitSidebar) {
    return null;
  }

  if (isEraserActive(appState)) {
    return t("hints.eraserRevert");
  }
  if (activeTool.type === "arrow" || activeTool.type === "line") {
    if (multiMode) {
      return t("hints.linearElementMulti");
    }
    if (activeTool.type === "arrow") {
      return t("hints.arrowTool", { arrowShortcut: getShortcutKey("A") });
    }
    return t("hints.linearElement");
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

  if (appState.editingTextElement) {
    return t("hints.text_editing");
  }

  if (appState.croppingElementId) {
    return t("hints.leaveCropEditor");
  }

  if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
    return t("hints.enterCropEditor");
  }

  if (activeTool.type === "selection") {
    if (
      appState.selectionElement &&
      !selectedElements.length &&
      !appState.editingTextElement &&
      !appState.editingLinearElement
    ) {
      return [t("hints.deepBoxSelect")];
    }

    if (isGridModeEnabled(app) && appState.selectedElementsAreBeingDragged) {
      return t("hints.disableSnapping");
    }

    if (!selectedElements.length && !isMobile) {
      return [t("hints.canvasPanning")];
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
        !appState.newElement &&
        !appState.selectedElementsAreBeingDragged &&
        isTextBindableContainer(selectedElements[0])
      ) {
        if (isFlowchartNodeElement(selectedElements[0])) {
          if (
            isNodeInFlowchart(
              selectedElements[0],
              app.scene.getNonDeletedElementsMap(),
            )
          ) {
            return [t("hints.bindTextToElement"), t("hints.createFlowchart")];
          }

          return [t("hints.bindTextToElement"), t("hints.createFlowchart")];
        }

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
  const hints = getHints({
    appState,
    isMobile,
    device,
    app,
  });

  if (!hints) {
    return null;
  }

  const hint = Array.isArray(hints)
    ? hints
        .map((hint) => {
          return getShortcutKey(hint).replace(/\. ?$/, "");
        })
        .join(". ")
    : getShortcutKey(hints);

  return (
    <div className="HintViewer">
      <span>{hint}</span>
    </div>
  );
};
