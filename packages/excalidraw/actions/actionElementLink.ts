import {
  canCreateLinkFromElements,
  defaultGetElementLinkFromSelection,
  getLinkIdAndTypeFromSelection,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { copyTextToSystemClipboard } from "../clipboard";
import { copyIcon, elementLinkIcon } from "../components/icons";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionCopyElementLink = register({
  name: "copyElementLink",
  label: "labels.copyElementLink",
  icon: copyIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    try {
      if (window.location) {
        const idAndType = getLinkIdAndTypeFromSelection(
          selectedElements,
          appState,
        );

        if (idAndType) {
          await copyTextToSystemClipboard(
            app.props.generateLinkForSelection
              ? app.props.generateLinkForSelection(idAndType.id, idAndType.type)
              : defaultGetElementLinkFromSelection(
                  idAndType.id,
                  idAndType.type,
                ),
          );

          return {
            appState: {
              toast: {
                message: t("toast.elementLinkCopied"),
                closable: true,
              },
            },
            captureUpdate: CaptureUpdateAction.EVENTUALLY,
          };
        }
        return {
          appState,
          elements,
          app,
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        };
      }
    } catch (error: any) {
      console.error(error);
    }

    return {
      appState,
      elements,
      app,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements, appState) =>
    canCreateLinkFromElements(getSelectedElements(elements, appState)),
});

export const actionLinkToElement = register({
  name: "linkToElement",
  label: "labels.linkToElement",
  icon: elementLinkIcon,
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    if (
      selectedElements.length !== 1 ||
      !canCreateLinkFromElements(selectedElements)
    ) {
      return {
        elements,
        appState,
        app,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      appState: {
        ...appState,
        openDialog: {
          name: "elementLinkSelector",
          sourceElementId: getSelectedElements(elements, appState)[0].id,
        },
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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
});
