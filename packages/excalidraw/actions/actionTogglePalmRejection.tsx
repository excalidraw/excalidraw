import { CaptureUpdateAction } from "@excalidraw/element";

import { PenModeIcon, handIcon } from "../components/icons";

import { register } from "./register";

export const actionTogglePalmRejection = register({
  name: "palmRejection",
  label: "labels.palmRejection",
  icon: PenModeIcon,
  keywords: ["palm", "rejection", "stylus", "pen", "touch", "ignore"],
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.palmRejection,
  },
  perform(elements, appState) {
    const enabled = !this.checked!(appState);
    return {
      appState: {
        ...appState,
        palmRejection: enabled,
        // a stylus should feel like one: taper strokes with (simulated)
        // pressure, same as what happens when a real pen is detected
        currentItemStrokeVariability: enabled
          ? "variable"
          : appState.currentItemStrokeVariability,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.palmRejection,
});

export const actionTogglePalmRejectionPinch = register({
  name: "palmRejectionPinch",
  label: "labels.palmRejectionPinch",
  icon: handIcon,
  keywords: ["palm", "pinch", "zoom", "pan", "two", "finger", "touch"],
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.palmRejectionPinch,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        palmRejectionPinch: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.palmRejectionPinch,
});

export const actionTogglePalmRejectionContactSize = register({
  name: "palmRejectionContactSize",
  label: "labels.palmRejectionContactSize",
  icon: PenModeIcon,
  keywords: ["palm", "size", "contact", "large", "touch"],
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.palmRejectionContactSize,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        palmRejectionContactSize: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.palmRejectionContactSize,
});
