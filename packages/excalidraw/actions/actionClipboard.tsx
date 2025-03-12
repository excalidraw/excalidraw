import {
  copyTextToSystemClipboard,
  copyToClipboard,
  createPasteEvent,
  probablySupportsClipboardBlob,
  probablySupportsClipboardWriteText,
  readSystemClipboard,
} from "../clipboard";
import { DuplicateIcon, cutIcon, pngIcon, svgIcon } from "../components/icons";
import { isFirefox } from "../constants";
import { exportCanvas, prepareElementsForExport } from "../data/index";
import { getTextFromElements, isTextElement } from "../element";
import { t } from "../i18n";
import { CODES, KEYS } from "../keys";
import { CaptureUpdateAction } from "../store";

import { actionDeleteSelected } from "./actionDeleteSelected";
import { register } from "./register";

export const actionCopy = register({
  name: "copy",
  label: "labels.copy",
  icon: DuplicateIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, event: ClipboardEvent | null, app) => {
    const elementsToCopy = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    try {
      await copyToClipboard(elementsToCopy, app.files, event);
    } catch (error: any) {
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          errorMessage: error.message,
        },
      };
    }

    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  // don't supply a shortcut since we handle this conditionally via onCopy event
  keyTest: undefined,
});

export const actionPaste = register({
  name: "paste",
  label: "labels.paste",
  trackEvent: { category: "element" },
  perform: async (elements, appState, data, app) => {
    let types;
    try {
      types = await readSystemClipboard();
    } catch (error: any) {
      if (error.name === "AbortError" || error.name === "NotAllowedError") {
        // user probably aborted the action. Though not 100% sure, it's best
        // to not annoy them with an error message.
        return false;
      }

      console.error(`actionPaste ${error.name}: ${error.message}`);

      if (isFirefox) {
        return {
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
          appState: {
            ...appState,
            errorMessage: t("hints.firefox_clipboard_write"),
          },
        };
      }

      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          errorMessage: t("errors.asyncPasteFailedOnRead"),
        },
      };
    }

    try {
      app.pasteFromClipboard(createPasteEvent({ types }));
    } catch (error: any) {
      console.error(error);
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          errorMessage: t("errors.asyncPasteFailedOnParse"),
        },
      };
    }

    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  // don't supply a shortcut since we handle this conditionally via onCopy event
  keyTest: undefined,
});

export const actionCut = register({
  name: "cut",
  label: "labels.cut",
  icon: cutIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, event: ClipboardEvent | null, app) => {
    actionCopy.perform(elements, appState, event, app);
    return actionDeleteSelected.perform(elements, appState, null, app);
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.X,
});

export const actionCopyAsSvg = register({
  name: "copyAsSvg",
  label: "labels.copyAsSvg",
  icon: svgIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, _data, app) => {
    if (!app.canvas) {
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const { exportedElements, exportingFrame } = prepareElementsForExport(
      elements,
      appState,
      true,
    );

    try {
      await exportCanvas(
        "clipboard-svg",
        exportedElements,
        appState,
        app.files,
        {
          ...appState,
          exportingFrame,
          name: app.getName(),
        },
      );

      const selectedElements = app.scene.getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      });

      return {
        appState: {
          toast: {
            message: t("toast.copyToClipboardAsSvg", {
              exportSelection: selectedElements.length
                ? t("toast.selection")
                : t("toast.canvas"),
              exportColorScheme: appState.exportWithDarkMode
                ? t("buttons.darkMode")
                : t("buttons.lightMode"),
            }),
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    } catch (error: any) {
      console.error(error);
      return {
        appState: {
          errorMessage: error.message,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  predicate: (elements) => {
    return probablySupportsClipboardWriteText && elements.length > 0;
  },
  keywords: ["svg", "clipboard", "copy"],
});

export const actionCopyAsPng = register({
  name: "copyAsPng",
  label: "labels.copyAsPng",
  icon: pngIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, _data, app) => {
    if (!app.canvas) {
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    const { exportedElements, exportingFrame } = prepareElementsForExport(
      elements,
      appState,
      true,
    );
    try {
      await exportCanvas("clipboard", exportedElements, appState, app.files, {
        ...appState,
        exportingFrame,
        name: app.getName(),
      });
      return {
        appState: {
          ...appState,
          toast: {
            message: t("toast.copyToClipboardAsPng", {
              exportSelection: selectedElements.length
                ? t("toast.selection")
                : t("toast.canvas"),
              exportColorScheme: appState.exportWithDarkMode
                ? t("buttons.darkMode")
                : t("buttons.lightMode"),
            }),
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    } catch (error: any) {
      console.error(error);
      return {
        appState: {
          ...appState,
          errorMessage: error.message,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  predicate: (elements) => {
    return probablySupportsClipboardBlob && elements.length > 0;
  },
  keyTest: (event) => event.code === CODES.C && event.altKey && event.shiftKey,
  keywords: ["png", "clipboard", "copy"],
});

export const copyText = register({
  name: "copyText",
  label: "labels.copyText",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    });

    try {
      copyTextToSystemClipboard(getTextFromElements(selectedElements));
    } catch (e) {
      throw new Error(t("errors.copyToSystemClipboardFailed"));
    }
    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements, appState, _, app) => {
    return (
      probablySupportsClipboardWriteText &&
      app.scene
        .getSelectedElements({
          selectedElementIds: appState.selectedElementIds,
          includeBoundTextElement: true,
        })
        .some(isTextElement)
    );
  },
  keywords: ["text", "clipboard", "copy"],
});
