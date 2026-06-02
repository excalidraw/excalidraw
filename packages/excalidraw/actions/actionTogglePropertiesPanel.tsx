import { CODES, KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { adjustmentsIcon } from "../components/icons";
import { register } from "./register";

export const actionTogglePropertiesPanel = register({
  name: "togglePropertiesPanel",
  label: "buttons.togglePropertiesPanel",
  icon: adjustmentsIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.isPropertiesPanelCollapsed,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        isPropertiesPanelCollapsed: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => !!appState.isPropertiesPanelCollapsed,
  predicate: (elements, appState, appProps, app) => {
    return app.editorInterface.formFactor !== "phone";
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && !event.shiftKey && !event.altKey && event.code === CODES.H,
});
