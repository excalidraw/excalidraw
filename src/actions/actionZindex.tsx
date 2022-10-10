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
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10.667 10.667V12a1.333 1.333 0 0 1-1.334 1.333H4A1.334 1.334 0 0 1 2.667 12V6.667A1.333 1.333 0 0 1 4 5.333h1.333"
          fill="currentColor"
        />
        <path
          d="M10.667 10.667V12a1.333 1.333 0 0 1-1.334 1.333H4A1.334 1.334 0 0 1 2.667 12V6.667A1.333 1.333 0 0 1 4 5.333h1.333"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 2.667H6.667c-.737 0-1.334.597-1.334 1.333v5.333c0 .737.597 1.334 1.334 1.334H12c.736 0 1.333-.597 1.333-1.334V4c0-.736-.597-1.333-1.333-1.333Z"
          fill="var(--default-bg-color)"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 2.667H6.667c-.737 0-1.334.597-1.334 1.333v5.333c0 .737.597 1.334 1.334 1.334H12c.736 0 1.333-.597 1.333-1.334V4c0-.736-.597-1.333-1.333-1.333Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.667 10.667V12a1.333 1.333 0 0 1-1.334 1.333H4A1.333 1.333 0 0 1 2.667 12V6.667A1.333 1.333 0 0 1 4 5.333h1.333"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10.667 4H5.333C4.597 4 4 4.597 4 5.333v5.334C4 11.403 4.597 12 5.333 12h5.334c.736 0 1.333-.597 1.333-1.333V5.333C12 4.597 11.403 4 10.667 4Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.333 1.6H9.067C8.477 1.6 8 2.078 8 2.667v4.266C8 7.523 8.478 8 9.067 8h4.266c.59 0 1.067-.478 1.067-1.067V2.667c0-.59-.478-1.067-1.067-1.067ZM6.933 8H2.667C2.077 8 1.6 8.478 1.6 9.067v4.266c0 .59.478 1.067 1.067 1.067h4.266c.59 0 1.067-.478 1.067-1.067V9.067C8 8.477 7.522 8 6.933 8Z"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
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
      <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13.3333 1.60001H9.06667C8.47756 1.60001 8 2.07757 8 2.66667V6.93334C8 7.52244 8.47756 8.00001 9.06667 8.00001H13.3333C13.9224 8.00001 14.4 7.52244 14.4 6.93334V2.66667C14.4 2.07757 13.9224 1.60001 13.3333 1.60001Z"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.93331 8H2.66664C2.07754 8 1.59998 8.47756 1.59998 9.06667V13.3333C1.59998 13.9224 2.07754 14.4 2.66664 14.4H6.93331C7.52241 14.4 7.99998 13.9224 7.99998 13.3333V9.06667C7.99998 8.47756 7.52241 8 6.93331 8Z"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.6667 4H5.33333C4.59695 4 4 4.59695 4 5.33333V10.6667C4 11.403 4.59695 12 5.33333 12H10.6667C11.403 12 12 11.403 12 10.6667V5.33333C12 4.59695 11.403 4 10.6667 4Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  ),
});
