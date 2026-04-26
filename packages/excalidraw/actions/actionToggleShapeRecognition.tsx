import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleShapeRecognition = register({
  name: "shapeRecognition",
  label: "labels.shapeRecognition",
  icon: () => null,
  viewMode: false,
  trackEvent: { category: "canvas" },
  perform(_elements, appState) {
    return {
      appState: {
        ...appState,
        shapeRecognitionEnabled: !appState.shapeRecognitionEnabled,
        pendingShapeRecognition: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.shapeRecognitionEnabled,
});
