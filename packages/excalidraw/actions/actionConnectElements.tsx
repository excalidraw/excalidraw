import { KEYS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  createBindingArrow,
  isFlowchartNodeElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFlowchartNodeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { announce, getElementText, getElementTypeLabel } from "../a11y";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppState } from "../types";

const getConnectCandidates = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
):
  | [
      NonDeleted<ExcalidrawFlowchartNodeElement>,
      NonDeleted<ExcalidrawFlowchartNodeElement>,
    ]
  | null => {
  const selected = getSelectedElements(elements, appState);
  if (
    selected.length === 2 &&
    selected.every(
      (element) => isFlowchartNodeElement(element) && !element.locked,
    )
  ) {
    return selected as [
      NonDeleted<ExcalidrawFlowchartNodeElement>,
      NonDeleted<ExcalidrawFlowchartNodeElement>,
    ];
  }
  return null;
};

/**
 * Drag-free arrow binding (WCAG 2.5.7): with exactly two shapes selected,
 * creates an arrow bound to both, source→target in reading order.
 */
export const actionConnectElements = register({
  name: "connectElements",
  label: "labels.connectElements",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => !!getConnectCandidates(elements, appState),
  keyTest: (event) =>
    event.code === "KeyC" &&
    event.altKey &&
    !event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD],
  perform: (elements, appState, _, app) => {
    const candidates = getConnectCandidates(elements, appState);
    if (!candidates) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    // source→target follows reading order (left-to-right, then top-down)
    const [source, target] = [...candidates].sort(
      (a, b) => a.x - b.x || a.y - b.y,
    );
    const dx = target.x + target.width / 2 - (source.x + source.width / 2);
    const dy = target.y + target.height / 2 - (source.y + source.height / 2);
    const direction =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0
          ? "right"
          : "left"
        : dy >= 0
        ? "down"
        : "up";

    const arrow = createBindingArrow(
      source,
      target,
      direction,
      appState as AppState,
      app.scene,
    );
    app.scene.insertElement(arrow);

    const elementsMap = app.scene.getNonDeletedElementsMap();
    announce(
      t("a11y.connected", {
        from:
          getElementText(source, elementsMap) ?? getElementTypeLabel(source),
        to: getElementText(target, elementsMap) ?? getElementTypeLabel(target),
      }),
    );

    return {
      elements: app.scene.getElementsIncludingDeleted(),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
