import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleGridSnap = register({
  name: "gridSnap",
  keywords: ["snap", "grid", "привязка"],
  label: "labels.gridSnap",
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridSnapEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        gridSnapEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.gridSnapEnabled,
  predicate: (element, appState) => {
    // Only show when grid is visible — snapping without grid makes no sense
    return appState.gridModeEnabled;
  },
});
