import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { angleIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleTechnicalDrawingMode = register({
  name: "technicalDrawingMode",
  label: "buttons.technicalDrawingMode",
  icon: angleIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.technicalDrawingMode,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        technicalDrawingMode: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.technicalDrawingMode,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    event.altKey &&
    event.shiftKey &&
    event.code === CODES.T,
});
