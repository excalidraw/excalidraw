import { copyTextToSystemClipboard } from "../clipboard";
import {
  canCreateLinkFromElements,
  createElementLink,
} from "../element/elementLink";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { StoreAction } from "../store";
import { register } from "./register";

export const actionCopeElementLink = register({
  name: "copyElementLink",
  label: "labels.copyElementLink",
  trackEvent: { category: "element" },
  perform: async (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    try {
      if (window.location) {
        await copyTextToSystemClipboard(
          createElementLink(
            selectedElements,
            window.location.origin,
            appState,
          ) ?? "",
        );
        return {
          appState: {
            toast: {
              message: t("toast.elementLinkCopied"),
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
    canCreateLinkFromElements(getSelectedElements(elements, appState)),
});

export const actionLinkToElement = register({
  name: "linkToElement",
  label: "labels.linkToElement",
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    if (selectedElements.length !== 1) {
      return { elements, appState, app, storeAction: StoreAction.NONE };
    }

    return {
      appState: {
        ...appState,
        openDialog: { name: "elementLinkSelector" },
        elementToLink: getSelectedElements(elements, appState)[0].id,
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  predicate: (elements, appState, appProps, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    return (
      appState.openDialog?.name !== "elementLinkSelector" &&
      selectedElements.length === 1 &&
      canCreateLinkFromElements(selectedElements)
    );
  },
  trackEvent: false,
  keyTest: (event) => {
    return event[KEYS.CTRL_OR_CMD] && event.key === KEYS.L && !event.altKey;
  },
});
