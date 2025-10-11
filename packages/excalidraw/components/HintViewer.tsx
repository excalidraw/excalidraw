import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";

import {
  isFlowchartNodeElement,
  isImageElement,
  isLinearElement,
  isLineElement,
  isTextBindableContainer,
  isTextElement,
} from "@excalidraw/element";

import { getShortcutKey } from "@excalidraw/common";

import { isNodeInFlowchart } from "@excalidraw/element";

import React from "react";

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

const getTaggedShortcutKey = (key: string) =>
  `<kbd>${getShortcutKey(key)}</kbd>`;

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
    appState.searchMatches?.matches.length
  ) {
    return t("hints.dismissSearch", {
      shortcut: getTaggedShortcutKey(t("keys.escape")),
    });
  }

  if (appState.openSidebar && !device.editor.canFitSidebar) {
    return null;
  }

  if (isEraserActive(appState)) {
    return t("hints.eraserRevert", {
      shortcut: getTaggedShortcutKey("Alt"),
    });
  }
  if (activeTool.type === "arrow" || activeTool.type === "line") {
    if (multiMode) {
      return t("hints.linearElementMulti", {
        shortcut_1: getTaggedShortcutKey(t("keys.escape")),
        shortcut_2: getTaggedShortcutKey(t("keys.enter")),
      });
    }
    if (activeTool.type === "arrow") {
      return t("hints.arrowTool", {
        shortcut: getTaggedShortcutKey("A"),
      });
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

  const selectedElements = app.scene.getSelectedElements(appState);

  if (
    isResizing &&
    lastPointerDownWith === "mouse" &&
    selectedElements.length === 1
  ) {
    const targetElement = selectedElements[0];
    if (isLinearElement(targetElement) && targetElement.points.length === 2) {
      return t("hints.lockAngle", {
        shortcut: getTaggedShortcutKey(t("keys.shift")),
      });
    }
    return isImageElement(targetElement)
      ? t("hints.resizeImage", {
          shortcut_1: getTaggedShortcutKey(t("keys.shift")),
          shortcut_2: getTaggedShortcutKey("Alt"),
        })
      : t("hints.resize", {
          shortcut_1: getTaggedShortcutKey(t("keys.shift")),
          shortcut_2: getTaggedShortcutKey("Alt"),
        });
  }

  if (isRotating && lastPointerDownWith === "mouse") {
    return t("hints.rotate", {
      shortcut: getTaggedShortcutKey(t("keys.shift")),
    });
  }

  if (selectedElements.length === 1 && isTextElement(selectedElements[0])) {
    return t("hints.text_selected", {
      shortcut: getTaggedShortcutKey(t("keys.enter")),
    });
  }

  if (appState.editingTextElement) {
    return t("hints.text_editing", {
      shortcut_1: getTaggedShortcutKey(t("keys.escape")),
      shortcut_2: `${getTaggedShortcutKey(
        "CtrlOrCmd",
      )} + ${getTaggedShortcutKey(t("keys.enter"))}`,
    });
  }

  if (appState.croppingElementId) {
    return t("hints.leaveCropEditor", {
      shortcut_1: getTaggedShortcutKey(t("keys.enter")),
      shortcut_2: getTaggedShortcutKey(t("keys.escape")),
    });
  }

  if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
    return t("hints.enterCropEditor", {
      shortcut: getTaggedShortcutKey(t("keys.enter")),
    });
  }

  if (activeTool.type === "selection") {
    if (
      appState.selectionElement &&
      !selectedElements.length &&
      !appState.editingTextElement &&
      !appState.selectedLinearElement?.isEditing
    ) {
      return [
        t("hints.deepBoxSelect", {
          shortcut: getTaggedShortcutKey("CtrlOrCmd"),
        }),
      ];
    }

    if (isGridModeEnabled(app) && appState.selectedElementsAreBeingDragged) {
      return t("hints.disableSnapping", {
        shortcut: getTaggedShortcutKey("CtrlOrCmd"),
      });
    }

    if (!selectedElements.length && !isMobile) {
      return [
        t("hints.canvasPanning", {
          shortcut: getTaggedShortcutKey(t("keys.spacebar")),
        }),
      ];
    }

    if (selectedElements.length === 1) {
      if (isLinearElement(selectedElements[0])) {
        if (appState.selectedLinearElement?.isEditing) {
          return appState.selectedLinearElement.selectedPointsIndices
            ? t("hints.lineEditor_pointSelected", {
                shortcut_1: getTaggedShortcutKey(t("keys.delete")),
                shortcut_2: `${getTaggedShortcutKey(
                  "CtrlOrCmd",
                )} + ${getTaggedShortcutKey("D")}`,
              })
            : t("hints.lineEditor_nothingSelected", {
                shortcut_1: getTaggedShortcutKey(t("keys.shift")),
                shortcut_2: getTaggedShortcutKey("ALt"),
              });
        }
        return isLineElement(selectedElements[0])
          ? t("hints.lineEditor_line_info", {
              shortcut: getTaggedShortcutKey(t("keys.enter")),
            })
          : t("hints.lineEditor_info", {
              shortcut_1: getTaggedShortcutKey("CtrlOrCmd"),
              shortcut_2: `${getTaggedShortcutKey(
                "CtrlOrCmd",
              )} + ${getTaggedShortcutKey(t("keys.enter"))}`,
            });
      }
      if (
        !appState.newElement &&
        !appState.selectedElementsAreBeingDragged &&
        isTextBindableContainer(selectedElements[0])
      ) {
        const bindTextToElement = t("hints.bindTextToElement", {
          shortcut: getTaggedShortcutKey(t("keys.enter")),
        });
        const createFlowChart = t("hints.createFlowchart", {
          shortcut: getTaggedShortcutKey("CtrlOrCmd"),
        });
        if (isFlowchartNodeElement(selectedElements[0])) {
          if (
            isNodeInFlowchart(
              selectedElements[0],
              app.scene.getNonDeletedElementsMap(),
            )
          ) {
            return [bindTextToElement, createFlowChart];
          }

          return [bindTextToElement, createFlowChart];
        }

        return bindTextToElement;
      }
    }
  }

  return null;
};

export const HintViewer = React.memo(
  ({ appState, isMobile, device, app }: HintViewerProps) => {
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
      ? hints.map((hint) => hint.replace(/\. ?$/, "")).join(". ")
      : hints;

    const hintJSX = hint.split(/(<kbd>[^<]+<\/kbd>)/g).map((part, index) => {
      if (index % 2 === 1) {
        const shortcutMatch =
          part[0] === "<" && part.match(/^<kbd>([^<]+)<\/kbd>$/);
        return <kbd key={index}>{shortcutMatch ? shortcutMatch[1] : part}</kbd>;
      }
      return part;
    });

    return (
      <div className="HintViewer">
        <span>{hintJSX}</span>
      </div>
    );
  },
);
