import { CaptureUpdateAction, isEmbeddableElement } from "@excalidraw/element";
import { register } from "./register";

export const actionManageTrustedDomains = register({
  name: "manageTrustedDomains",
  label: "labels.manageTrustedDomains",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return selected.length === 1 && isEmbeddableElement(selected[0]);
  },
  perform: (elements, appState) => {
    return {
      elements,
      appState: { ...appState, openDialog: { name: "trustedDomains" } },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
