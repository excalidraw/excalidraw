import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionAITidySelection = register({
  name: "aiTidySelection",
  label: "AI tidy selection",
  keywords: ["ai", "tidy", "layout", "organize", "selection"],
  trackEvent: {
    category: "menu",
    action: "aiTidySelection",
  },
  viewMode: false,
  predicate: (_elements, appState, appProps, app) => {
    if (appProps.aiEnabled === false || !app.plugins.aiTidySelection?.tidy) {
      return false;
    }

    if (
      appState.newElement ||
      appState.editingTextElement ||
      appState.selectedElementsAreBeingDragged ||
      appState.selectionElement ||
      appState.multiElement
    ) {
      return false;
    }

    return Object.keys(appState.selectedElementIds).length >= 2;
  },
  perform: async (_elements, appState, _formData, app) => {
    await app.onAITidySelection();
    return {
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
