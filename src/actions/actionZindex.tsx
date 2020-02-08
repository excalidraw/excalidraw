import React from "react";
import { Action } from "./types";
import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
} from "../zindex";
import { getSelectedIndices } from "../scene";
import { KEYS } from "../keys";

export const actionSendBackward: Action = {
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
    <button type="button" onClick={e => updateData(null)}>
      Send Backward
    </button>
  ),
};

export const actionBringForward: Action = {
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
    <button type="button" onClick={e => updateData(null)}>
      Bring Forward
    </button>
  ),
};

export const actionSendToBack: Action = {
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
    <button type="button" onClick={e => updateData(null)}>
      Send to Back
    </button>
  ),
};

export const actionBringToFront: Action = {
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
    <button type="button" onClick={e => updateData(null)}>
      Bring to Front
    </button>
  ),
};
