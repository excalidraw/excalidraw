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
};
