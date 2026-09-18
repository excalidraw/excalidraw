import { isTextElement } from "@excalidraw/element";
import { getTextFromElements } from "@excalidraw/element";

import { CODES, KEYS, isFirefox } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  copyTextToSystemClipboard,
  copyToClipboard,
  createPasteEvent,
  probablySupportsClipboardBlob,
  probablySupportsClipboardWriteText,
  readSystemClipboard,
} from "../clipboard";
import { DuplicateIcon, cutIcon, pngIcon, svgIcon } from "../components/icons";
import { exportCanvas, prepareElementsForExport } from "../data/index";
import { t } from "../i18n";

import { actionDeleteSelected } from "./actionDeleteSelected";
import { register } from "./register";

import type { ActionResult } from "./types";

import type { AppClassProperties, AppState } from "../types";

export const actionCopy = register<ClipboardEvent | null>({
  name: "copy",
  label: "labels.copy",
  icon: DuplicateIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, event, app) => {
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

export const actionCut = register<ClipboardEvent | null>({
  name: "cut",
  label: "labels.cut",
  icon: cutIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, event, app) => {
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

/** Resolution multiplier for the transparent PNG copy, which ignores the
 * user's export scale so the result is predictable wherever it's pasted. */
export const TRANSPARENT_PNG_COPY_SCALE = 2;

/**
 * Renders the current selection (or the whole canvas, when nothing is
 * selected) to the clipboard as a PNG.
 *
 * `overrides` let a caller pin the export settings the action cares about
 * instead of inheriting them from the user's export preferences.
 */
const copyToClipboardAsPng = async (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  {
    overrides,
    getToastMessage,
  }: {
    overrides?: Pick<Partial<AppState>, "exportBackground" | "exportScale">;
    getToastMessage: (exportSelection: string) => string;
  },
): Promise<ActionResult> => {
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

  const exportAppState = { ...appState, ...overrides };

  try {
    await exportCanvas(
      "clipboard",
      exportedElements,
      exportAppState,
      app.files,
      {
        ...exportAppState,
        exportingFrame,
        name: app.getName(),
      },
    );
    return {
      appState: {
        ...appState,
        toast: {
          message: getToastMessage(
            selectedElements.length ? t("toast.selection") : t("toast.canvas"),
          ),
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
};

export const actionCopyAsPng = register({
  name: "copyAsPng",
  label: "labels.copyAsPng",
  icon: pngIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, _data, app) =>
    copyToClipboardAsPng(elements, appState, app, {
      getToastMessage: (exportSelection) =>
        t("toast.copyToClipboardAsPng", {
          exportSelection,
          exportColorScheme: appState.exportWithDarkMode
            ? t("buttons.darkMode")
            : t("buttons.lightMode"),
        }),
    }),
  predicate: (elements) => {
    return probablySupportsClipboardBlob && elements.length > 0;
  },
  keyTest: (event) => event.code === CODES.C && event.altKey && event.shiftKey,
  keywords: ["png", "clipboard", "copy"],
});

export const actionCopyAsPngTransparent = register({
  name: "copyAsPngTransparent",
  label: "labels.copyAsPngTransparent",
  icon: pngIcon,
  trackEvent: { category: "element" },
  perform: async (elements, appState, _data, app) =>
    copyToClipboardAsPng(elements, appState, app, {
      // pinned rather than read from the user's export preferences: this
      // action's whole point is a transparent, hi-dpi copy
      overrides: {
        exportBackground: false,
        exportScale: TRANSPARENT_PNG_COPY_SCALE,
      },
      getToastMessage: (exportSelection) =>
        t("toast.copyToClipboardAsPngTransparent", {
          exportSelection,
          exportScale: TRANSPARENT_PNG_COPY_SCALE,
        }),
    }),
  predicate: (elements) => {
    return probablySupportsClipboardBlob && elements.length > 0;
  },
  keywords: ["png", "clipboard", "copy", "transparent", "2x", "retina"],
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
