import React from "react";
import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "../zindex";
import { KEYS, isDarwin, CODES } from "../keys";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";
import { register } from "./register";
import {
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from "../components/icons";

export const actionSendBackward = register({
  name: "sendBackward",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveOneLeft(elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.sendBackward",
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (
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
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveOneRight(elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.bringForward",
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData, appState }) => (
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
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft(elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.sendToBack",
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_LEFT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (
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
  trackEvent: { category: "element" },

  perform: (elements, appState) => {
    return {
      elements: moveAllRight(elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.bringToFront",
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_RIGHT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData, appState }) => (
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
      {BringToFrontIcon}
    </button>
  ),
});
