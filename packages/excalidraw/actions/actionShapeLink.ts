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
          createShapeLink(selectedElements, window.location.origin, appState) ??
            "",
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
  keyTest: (event) =>
    event.shiftKey &&
    event.key.toLowerCase() === KEYS.L &&
    !event[KEYS.CTRL_OR_CMD],
  predicate: (elements, appState, appProps, app) =>
    canCreateShapeLinkFromElements(getSelectedElements(elements, appState)),
});

export const actionLinkToShape = register({
  name: "linkToShape",
  label: "labels.linkToShape",
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    if (selectedElements.length !== 1) {
      return { elements, appState, app, storeAction: StoreAction.NONE };
    }

    return {
      appState: {
        ...appState,
        shapeSelectionEnabled: true,
        elementToLink: getSelectedElements(elements, appState)[0].id,
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  predicate: (elements, appState, appProps, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    return (
      !appState.shapeSelectionEnabled &&
      selectedElements.length === 1 &&
      canCreateShapeLinkFromElements(selectedElements)
    );
  },
  trackEvent: false,
  keyTest: (event) => {
    return event[KEYS.CTRL_OR_CMD] && event.key === KEYS.L && !event.altKey;
  },
});
