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
import { t } from "../i18n";

const ACTIVE_ELEM_COLOR = "#ffa94d"; // OC ORANGE 4

const ICONS = {
  bringForward: (
    <svg viewBox="0 0 24 24">
      <path
        d="M22 9.556C22 8.696 21.303 8 20.444 8H16v8H8v4.444C8 21.304 8.697 22 9.556 22h10.888c.86 0 1.556-.697 1.556-1.556V9.556z"
        stroke="#000"
        strokeWidth="2"
      />
      <path
        d="M16 3.556C16 2.696 15.303 2 14.444 2H3.556C2.696 2 2 2.697 2 3.556v10.888C2 15.304 2.697 16 3.556 16h10.888c.86 0 1.556-.697 1.556-1.556V3.556z"
        fill={ACTIVE_ELEM_COLOR}
        stroke={ACTIVE_ELEM_COLOR}
        strokeWidth="2"
      />
    </svg>
  ),
  sendBackward: (
    <svg viewBox="0 0 24 24">
      <path
        d="M16 3.556C16 2.696 15.303 2 14.444 2H3.556C2.696 2 2 2.697 2 3.556v10.888C2 15.304 2.697 16 3.556 16h10.888c.86 0 1.556-.697 1.556-1.556V3.556z"
        fill={ACTIVE_ELEM_COLOR}
        stroke={ACTIVE_ELEM_COLOR}
        strokeWidth="2"
      />
      <path
        d="M22 9.556C22 8.696 21.303 8 20.444 8H9.556C8.696 8 8 8.697 8 9.556v10.888C8 21.304 8.697 22 9.556 22h10.888c.86 0 1.556-.697 1.556-1.556V9.556z"
        stroke="#000"
        strokeWidth="2"
      />
    </svg>
  ),
  bringToFront: (
    <svg viewBox="0 0 24 24">
      <path
        d="M13 21a1 1 0 001 1h7a1 1 0 001-1v-7a1 1 0 00-1-1h-3v5h-5v3zM11 3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h3V6h5V3z"
        stroke="#000"
        strokeWidth="2"
      />
      <path
        d="M18 7.333C18 6.597 17.403 6 16.667 6H7.333C6.597 6 6 6.597 6 7.333v9.334C6 17.403 6.597 18 7.333 18h9.334c.736 0 1.333-.597 1.333-1.333V7.333z"
        fill={ACTIVE_ELEM_COLOR}
        stroke={ACTIVE_ELEM_COLOR}
        strokeWidth="2"
      />
    </svg>
  ),
  sendToBack: (
    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M18 7.333C18 6.597 17.403 6 16.667 6H7.333C6.597 6 6 6.597 6 7.333v9.334C6 17.403 6.597 18 7.333 18h9.334c.736 0 1.333-.597 1.333-1.333V7.333z"
        fill={ACTIVE_ELEM_COLOR}
        stroke={ACTIVE_ELEM_COLOR}
        strokeWidth="2"
      />
      <path
        d="M11 3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h8V3zM22 14a1 1 0 00-1-1h-7a1 1 0 00-1 1v7a1 1 0 001 1h8v-8z"
        stroke="#000"
        strokeWidth="2"
      />
    </svg>
  ),
};

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
    <button
      type="button"
      className="zIndexButton"
      onClick={e => updateData(null)}
      title={t("labels.sendBackward")}
    >
      {ICONS.sendBackward}
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
    <button
      type="button"
      className="zIndexButton"
      onClick={e => updateData(null)}
      title={t("labels.bringForward")}
    >
      {ICONS.bringForward}
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
    <button
      type="button"
      className="zIndexButton"
      onClick={e => updateData(null)}
      title={t("labels.sendToBack")}
    >
      {ICONS.sendToBack}
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
    <button
      type="button"
      className="zIndexButton"
      onClick={e => updateData(null)}
      title={t("labels.bringToFront")}
    >
      {ICONS.bringToFront}
    </button>
  ),
};
