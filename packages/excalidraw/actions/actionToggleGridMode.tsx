import { CODES, KEYS } from "@excalidraw/common";

import { gridIcon } from "../components/icons";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleGridMode = register({
  name: "gridMode",
  icon: gridIcon,
  keywords: ["snap"],
  label: "labels.toggleGrid",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        gridModeEnabled: !this.checked!(appState),
        objectsSnapModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.gridModeEnabled,
  predicate: (element, appState, props) => {
    return props.gridModeEnabled === undefined;
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE,
});
