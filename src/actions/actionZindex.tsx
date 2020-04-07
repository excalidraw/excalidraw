import React from "react";
import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "../zindex";
import { KEYS, isDarwin } from "../keys";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";
import { register } from "./register";
import {
  sendBackward,
  bringToFront,
  sendToBack,
  bringForward,
} from "../components/icons";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";

function getElementIndices(
  direction: "left" | "right",
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const selectedIndices: number[] = [];
  let deletedIndicesCache: number[] = [];

  function cb(element: ExcalidrawElement, index: number) {
    if (element.isDeleted) {
      // we want to build an array of deleted elements that are preceeding
      //  a selected element so that we move them together
      deletedIndicesCache.push(index);
    } else {
      if (appState.selectedElementIds[element.id]) {
        selectedIndices.push(...deletedIndicesCache, index);
      }
      // always empty cache of deleted elements after either pushing a group
      //  of selected/deleted elements, of after encountering non-deleted elem
      deletedIndicesCache = [];
    }
  }

  // sending back → select contiguous deleted elements that are to the left of
  //  selected element(s)
  if (direction === "left") {
    let i = -1;
    const len = elements.length;
    while (++i < len) {
      cb(elements[i], i);
    }
    // moving to front → loop from right to left so that we don't need to
    //  backtrack when gathering deleted elements
  } else {
    let i = elements.length;
    while (--i > -1) {
      cb(elements[i], i);
    }
  }
  // sort in case we were gathering indexes from right to left
  return selectedIndices.sort();
}

function moveElements(
  func: typeof moveOneLeft,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const _elements = elements.slice();
  const direction =
    func === moveOneLeft || func === moveAllLeft ? "left" : "right";
  const indices = getElementIndices(direction, _elements, appState);
  return func(_elements, indices);
}

export const actionSendBackward = register({
  name: "sendBackward",
  perform: (elements, appState) => {
    return {
      elements: moveElements(moveOneLeft, elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.sendBackward",
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && !event.shiftKey && event.code === "BracketLeft",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendBackward")} — ${getShortcutKey("CtrlOrCmd+[")}`}
    >
      {sendBackward}
    </button>
  ),
});

export const actionBringForward = register({
  name: "bringForward",
  perform: (elements, appState) => {
    return {
      elements: moveElements(moveOneRight, elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.bringForward",
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && !event.shiftKey && event.code === "BracketRight",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringForward")} — ${getShortcutKey("CtrlOrCmd+]")}`}
    >
      {bringForward}
    </button>
  ),
});

export const actionSendToBack = register({
  name: "sendToBack",
  perform: (elements, appState) => {
    return {
      elements: moveElements(moveAllLeft, elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.sendToBack",
  keyTest: (event) => {
    return isDarwin
      ? event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === "BracketLeft"
      : event[KEYS.CTRL_OR_CMD] &&
          event.shiftKey &&
          event.code === "BracketLeft";
  },
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendToBack")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+[")
          : getShortcutKey("CtrlOrCmd+Shift+[")
      }`}
    >
      {sendToBack}
    </button>
  ),
});

export const actionBringToFront = register({
  name: "bringToFront",
  perform: (elements, appState) => {
    return {
      elements: moveElements(moveAllRight, elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.bringToFront",
  keyTest: (event) => {
    return isDarwin
      ? event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === "BracketRight"
      : event[KEYS.CTRL_OR_CMD] &&
          event.shiftKey &&
          event.code === "BracketRight";
  },
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={(event) => updateData(null)}
      title={`${t("labels.bringToFront")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]")
      }`}
    >
      {bringToFront}
    </button>
  ),
});
