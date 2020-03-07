import React from "react";
import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "../zindex";
import { getSelectedIndices } from "../scene";
import { KEYS } from "../keys";
import { t } from "../i18n";
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
      elements: moveOneLeft([...elements], getSelectedIndices(elements)),
      appState,
    };
  },
  contextItemLabel: "labels.sendBackward",
  keyPriority: 40,
  commitToHistory: () => true,
  keyTest: event => event[KEYS.META] && event.altKey && event.key === "B",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={t("labels.sendBackward")}
    >
      {sendBackward}
    </button>
  ),
});

export const actionBringForward = register({
  name: "bringForward",
  perform: (elements, appState) => {
    return {
      elements: moveOneRight([...elements], getSelectedIndices(elements)),
      appState,
    };
  },
  contextItemLabel: "labels.bringForward",
  keyPriority: 40,
  commitToHistory: () => true,
  keyTest: event => event[KEYS.META] && event.altKey && event.key === "F",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={t("labels.bringForward")}
    >
      {bringForward}
    </button>
  ),
});

export const actionSendToBack = register({
  name: "sendToBack",
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft([...elements], getSelectedIndices(elements)),
      appState,
    };
  },
  contextItemLabel: "labels.sendToBack",
  commitToHistory: () => true,
  keyTest: event => event[KEYS.META] && event.shiftKey && event.key === "B",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={t("labels.sendToBack")}
    >
      {sendToBack}
    </button>
  ),
});

export const actionBringToFront = register({
  name: "bringToFront",
  perform: (elements, appState) => {
    return {
      elements: moveAllRight([...elements], getSelectedIndices(elements)),
      appState,
    };
  },
  commitToHistory: () => true,
  contextItemLabel: "labels.bringToFront",
  keyTest: event => event[KEYS.META] && event.shiftKey && event.key === "F",
  PanelComponent: ({ updateData }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={event => updateData(null)}
      title={t("labels.bringToFront")}
    >
      {bringToFront}
    </button>
  ),
});
