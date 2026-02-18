import { KEYS, CODES, isDarwin } from "@excalidraw/common";

import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import { register } from "./register";

export const actionSendBackward = register({
  name: "sendBackward",
  label: "labels.sendBackward",
  keywords: ["move down", "zindex", "layer"],
  icon: SendBackwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: moveOneLeft(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendBackward")} — ${getShortcutKey("CtrlOrCmd+[")}`}
    >
      {SendBackwardIcon}
    </button>
  ),
});

export const actionBringForward = register({
  name: "bringForward",
  label: "labels.bringForward",
  keywords: ["move up", "zindex", "layer"],
  icon: BringForwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: moveOneRight(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringForward")} — ${getShortcutKey("CtrlOrCmd+]")}`}
    >
      {BringForwardIcon}
    </button>
  ),
});

export const actionSendToBack = register({
  name: "sendToBack",
  label: "labels.sendToBack",
  keywords: ["move down", "zindex", "layer"],
  icon: SendToBackIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_LEFT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_LEFT,
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
      {SendToBackIcon}
    </button>
  ),
});

export const actionBringToFront = register({
  name: "bringToFront",
  label: "labels.bringToFront",
  keywords: ["move up", "zindex", "layer"],
  icon: BringToFrontIcon,
  trackEvent: { category: "element" },

  perform: (elements, appState) => {
    return {
      elements: moveAllRight(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_RIGHT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringToFront")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]")
      }`}
    >
      {BringToFrontIcon}
    </button>
  ),
});

// NEW: bring selected elements to the middle of the stacking order
export const actionBringToMiddle = register({
  name: "bringToMiddle",
  label: "labels.bringToMiddle",
  keywords: ["move middle", "zindex", "layer"],
  icon: BringForwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    // selected element ids
    const selectedIds = new Set(
      Object.keys(appState.selectedElementIds).filter(
        (id) => appState.selectedElementIds[id],
      ),
    );

    if (!selectedIds.size) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    // split deleted / non-deleted
    const nonDeleted = elements.filter((el) => !el.isDeleted);
    const deleted = elements.filter((el) => el.isDeleted);

    // separate selected vs remaining WITHOUT mutating readonly arrays
    const selected = nonDeleted.filter((el) => selectedIds.has(el.id));
    const remaining = nonDeleted.filter((el) => !selectedIds.has(el.id));

    if (!selected.length) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    // compute middle index
    const middleIndex = Math.floor(remaining.length / 2);
    const before = remaining.slice(0, middleIndex);
    const after = remaining.slice(middleIndex);

    const reorderedNonDeleted = [...before, ...selected, ...after];
    const nextElements = [...reorderedNonDeleted, ...deleted];

    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  // Ctrl/Cmd + M
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === "m",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringToMiddle")} — ${getShortcutKey("CtrlOrCmd+M")}`}
    >
      MID
    </button>
  ),
});
