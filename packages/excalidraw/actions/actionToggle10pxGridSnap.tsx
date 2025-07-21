import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { gridIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggle10pxGridSnap = register({
  name: "toggle10pxGridSnap",
  icon: gridIcon,
  keywords: ["snap", "grid", "10px"],
  label: "labels.toggle10pxGridSnap",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.tenPxGridSnapEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        tenPxGridSnapEnabled: !this.checked!(appState),
        gridModeEnabled: false,
        objectsSnapModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.tenPxGridSnapEnabled,
  predicate: (element, appState, props) => {
    return props.tenPxGridSnapEnabled === undefined;
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.code === CODES.QUOTE,
});
