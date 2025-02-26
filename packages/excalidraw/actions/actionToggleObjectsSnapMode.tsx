import { magnetIcon } from "../components/icons";
import { CODES, KEYS } from "../keys";
import { CaptureUpdateAction } from "../store";
import { register } from "./register";

export const actionToggleObjectsSnapMode = register({
  name: "objectsSnapMode",
  label: "buttons.objectsSnapMode",
  icon: magnetIcon,
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.objectsSnapModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        objectsSnapModeEnabled: !this.checked!(appState),
        gridModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.objectsSnapModeEnabled,
  predicate: (elements, appState, appProps) => {
    return typeof appProps.objectsSnapModeEnabled === "undefined";
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.S,
});
