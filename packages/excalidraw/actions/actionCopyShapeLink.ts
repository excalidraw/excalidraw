import { copyTextToSystemClipboard } from "../clipboard";
import {
  canCreateShapeLinkFromElements,
  createShapeLink,
} from "../element/shapeLinks";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { StoreAction } from "../store";
import { register } from "./register";

export const actionCopyShapeLink = register({
  name: "copyShapeLink",
  label: "labels.copyShapeLink",
  trackEvent: { category: "element" },
  perform: async (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    try {
      if (window.location) {
        await copyTextToSystemClipboard(
          createShapeLink(selectedElements, window.location.origin) ?? "",
        );
        return {
          appState: {
            toast: {
              message: t("toast.shapeLinkCopied"),
              closable: true,
            },
          },
          storeAction: StoreAction.NONE,
        };
      }
    } catch (error: any) {
      console.error(error);
    }

    return {
      appState,
      elements,
      app,
      storeAction: StoreAction.NONE,
    };
  },
  predicate: (elements, appState, appProps, app) =>
    canCreateShapeLinkFromElements(getSelectedElements(elements, appState)),
  keyTest: (event) => {
    return event[KEYS.CTRL_OR_CMD] && event.key === KEYS.K && event.altKey;
  },
});
