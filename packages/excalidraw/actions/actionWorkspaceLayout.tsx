import { CaptureUpdateAction } from "@excalidraw/element";

import { frameToolIcon } from "../components/icons";
import { getDefaultWorkspaceLayout } from "../workspaceLayout";

import { register } from "./register";

export const actionToggleWorkspaceLayoutEdit = register({
  name: "toggleWorkspaceLayoutEdit",
  label: "labels.workspaceLayoutEdit",
  icon: frameToolIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        workspaceLayout: {
          ...appState.workspaceLayout,
          editing: !this.checked!(appState),
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.workspaceLayout.editing,
  predicate: (elements, appState, appProps, app) => {
    return app.editorInterface.formFactor !== "phone";
  },
});

export const actionResetWorkspaceLayout = register({
  name: "resetWorkspaceLayout",
  label: "labels.workspaceLayoutReset",
  icon: frameToolIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        workspaceLayout: {
          ...getDefaultWorkspaceLayout(),
          editing: appState.workspaceLayout.editing,
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements, appState, appProps, app) => {
    return app.editorInterface.formFactor !== "phone";
  },
});
