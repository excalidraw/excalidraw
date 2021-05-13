import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { copyToClipboard } from "../clipboard";
import { actionDeleteSelected } from "./actionDeleteSelected";
import { getSelectedElements } from "../scene/selection";
import { exportCanvas } from "../data/index";
import { getNonDeletedElements } from "../element";
import { t } from "../i18n";

export const actionCopy = register({
  name: "copy",
  perform: (elements, appState) => {
    copyToClipboard(getNonDeletedElements(elements), appState);

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
  perform: (elements, appState, data, app) => {
    actionCopy.perform(elements, appState, data, app);
    return actionDeleteSelected.perform(elements, appState, data, app);
  },
  contextItemLabel: "labels.cut",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.code === CODES.X,
});

export const actionCopyAsSvg = register({
  name: "copyAsSvg",
  perform: async (elements, appState, _data, app) => {
    if (!app.canvas) {
      return {
        commitToHistory: false,
      };
    }
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    try {
      await exportCanvas(
        "clipboard-svg",
        selectedElements.length
          ? selectedElements
          : getNonDeletedElements(elements),
        appState,
        appState,
      );
      return {
        commitToHistory: false,
      };
    } catch (error) {
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
  perform: async (elements, appState, _data, app) => {
    if (!app.canvas) {
      return {
        commitToHistory: false,
      };
    }
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    try {
      await exportCanvas(
        "clipboard",
        selectedElements.length
          ? selectedElements
          : getNonDeletedElements(elements),
        appState,
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
    } catch (error) {
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
