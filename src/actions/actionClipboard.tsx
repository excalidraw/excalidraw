import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { copyTextToSystemClipboard, copyToClipboard } from "../clipboard";
import { actionDeleteSelected } from "./actionDeleteSelected";
import { getSelectedElements } from "../scene/selection";
import { exportCanvas } from "../data/index";
import { getNonDeletedElements } from "../element";
import { t } from "../i18n";

export const actionCopy = register({
  name: "copy",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    copyToClipboard(getNonDeletedElements(elements), appState, app.files);

    return {
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.copy",
  // don't supply a shortcut since we handle this conditionally via onCopy event
  keyTest: undefined,
});

export const actionCut = register({
  name: "cut",
  trackEvent: { category: "element" },
  perform: (elements, appState, data, app) => {
    actionCopy.perform(elements, appState, data, app);
    return actionDeleteSelected.perform(elements, appState);
  },
  contextItemLabel: "labels.cut",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.X,
});

export const actionCopyAsSvg = register({
  name: "copyAsSvg",
  trackEvent: { category: "element" },
  perform: async (elements, appState, _data, app) => {
    if (!app.canvas) {
      return {
        commitToHistory: false,
      };
    }
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      true,
    );
    try {
      await exportCanvas(
        "clipboard-svg",
        selectedElements.length
          ? selectedElements
          : getNonDeletedElements(elements),
        appState,
        app.files,
        appState,
      );
      return {
        commitToHistory: false,
      };
    } catch (error: any) {
      console.error(error);
      return {
        appState: {
          ...appState,
          errorMessage: error.message,
        },
        commitToHistory: false,
      };
    }
  },
  contextItemLabel: "labels.copyAsSvg",
});

export const actionCopyAsPng = register({
  name: "copyAsPng",
  trackEvent: { category: "element" },
  perform: async (elements, appState, _data, app) => {
    if (!app.canvas) {
      return {
        commitToHistory: false,
      };
    }
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      true,
    );
    try {
      await exportCanvas(
        "clipboard",
        selectedElements.length
          ? selectedElements
          : getNonDeletedElements(elements),
        appState,
        app.files,
        appState,
      );
      return {
        appState: {
          ...appState,
          toastMessage: t("toast.copyToClipboardAsPng", {
            exportSelection: selectedElements.length
              ? t("toast.selection")
              : t("toast.canvas"),
            exportColorScheme: appState.exportWithDarkMode
              ? t("buttons.darkMode")
              : t("buttons.lightMode"),
          }),
        },
        commitToHistory: false,
      };
    } catch (error: any) {
      console.error(error);
      return {
        appState: {
          ...appState,
          errorMessage: error.message,
        },
        commitToHistory: false,
      };
    }
  },
  contextItemLabel: "labels.copyAsPng",
  keyTest: (event) => event.code === CODES.C && event.altKey && event.shiftKey,
});

export const copyAllTextNodesAsText = register({
  name: "copyAllTextNodesAsText",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
      false,
    );

    const text = selectedElements.reduce((acc, element) => {
      if (element.type === "text") {
        return `${acc}${element.text}\n`;
      }
      return acc;
    }, "");
    copyTextToSystemClipboard(text);
    return {
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.copyAllTextNodesAsText",
});
