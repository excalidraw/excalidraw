import { CaptureUpdateAction, isArrowElement } from "@excalidraw/element";

import { register } from "./register";

export const actionAISmartConnectorLabels = register({
  name: "aiSmartConnectorLabels",
  label: "AI suggest connector labels",
  keywords: ["ai", "connector", "arrow", "label", "text"],
  trackEvent: {
    category: "menu",
    action: "aiSmartConnectorLabels",
  },
  viewMode: false,
  predicate: (_elements, appState, appProps, app) => {
    if (
      appProps.aiEnabled === false ||
      !app.plugins.aiSmartConnectorLabels?.suggest ||
      appState.editingTextElement
    ) {
      return false;
    }

    const selectedArrows = app.scene
      .getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
      })
      .filter(isArrowElement);

    return selectedArrows.length > 0;
  },
  perform: async (_elements, appState, _formData, app) => {
    await app.onAISmartConnectorLabels();
    return {
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
