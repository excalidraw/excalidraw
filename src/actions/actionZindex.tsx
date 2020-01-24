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
  keyTest: event =>
    event[KEYS.META] && event.shiftKey && event.altKey && event.code === "KeyB",
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
  keyTest: event =>
    event[KEYS.META] && event.shiftKey && event.altKey && event.code === "KeyF",
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
  keyTest: event => event[KEYS.META] && event.shiftKey && event.code === "KeyB",
};

export const actionBringToFront: Action = {
  name: "bringToFront",
  perform: (elements, appState) => {
    return {
      elements: moveAllRight([...elements], getSelectedIndices(elements)),
      appState,
    };
  },
  contextItemLabel: "labels.bringToFront",
  keyTest: event => event[KEYS.META] && event.shiftKey && event.code === "KeyF",
};
