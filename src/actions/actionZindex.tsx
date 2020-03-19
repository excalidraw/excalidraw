import React from "react";
import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "../zindex";
import { getSelectedIndices } from "../scene";
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

export const actionSendBackward = register({
  name: "sendBackward",
  perform: (elements, appState) => {
    return {
      elements: moveOneLeft(
        [...elements],
        getSelectedIndices(elements, appState),
      ),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.sendBackward",
  keyPriority: 40,
  keyTest: event =>
    event[KEYS.CTRL_OR_CMD] && !event.shiftKey && event.code === "BracketLeft",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendBackward")} ${getShortcutKey("CtrlOrCmd+[")}`}
    >
      {sendBackward}
    </button>
  ),
});

export const actionBringForward = register({
  name: "bringForward",
  perform: (elements, appState) => {
    return {
      elements: moveOneRight(
        [...elements],
        getSelectedIndices(elements, appState),
      ),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.bringForward",
  keyPriority: 40,
  keyTest: event =>
    event[KEYS.CTRL_OR_CMD] && !event.shiftKey && event.code === "BracketRight",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringForward")} ${getShortcutKey("CtrlOrCmd+]")}`}
    >
      {bringForward}
    </button>
  ),
});

export const actionSendToBack = register({
  name: "sendToBack",
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft(
        [...elements],
        getSelectedIndices(elements, appState),
      ),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.sendToBack",
  keyTest: event => {
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
      title={`${t("labels.sendToBack")} ${
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
      elements: moveAllRight(
        [...elements],
        getSelectedIndices(elements, appState),
      ),
      appState,
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.bringToFront",
  keyTest: event => {
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
      onClick={event => updateData(null)}
      title={`${t("labels.bringToFront")} ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]")
      }`}
    >
      {bringToFront}
    </button>
  ),
});
