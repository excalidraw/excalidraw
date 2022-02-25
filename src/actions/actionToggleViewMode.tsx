import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { trackEvent } from "../analytics";

export const actionToggleViewMode = register({
  name: "viewMode",
  perform(elements, appState, app) {
    //zsviczian
    trackEvent("view", "mode", "view");
    if (app.props.onViewModeChange) {
      //zsviczian
      app.props.onViewModeChange(!this.checked!(appState));
    }
    return {
      appState: {
        ...appState,
        viewModeEnabled: !this.checked!(appState),
      },
      commitToHistory: false,
    };
  },
  checked: (appState) => appState.viewModeEnabled,
  contextItemLabel: "labels.viewMode",
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.R,
});
