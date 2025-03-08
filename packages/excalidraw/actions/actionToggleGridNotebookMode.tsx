import { CODES, KEYS } from "../keys";
import { register } from "./register";
import type { AppState } from "../types";
import { gridIcon } from "../components/icons";
import { CaptureUpdateAction } from "../store";

export const actionToggleGridNotebookMode = register({
  name: "gridModeNotebook",
  icon: gridIcon,
  keywords: ["snap"],
  label: "labels.toggleGridNotebook",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridModeNotebookEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        gridModeNotebookEnabled: !this.checked!(appState),
        objectsSnapModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.gridModeNotebookEnabled,
  predicate: (element, appState, props) => {
    return props.gridModeNotebookEnabled === undefined;
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.SEMICOLON,
});
