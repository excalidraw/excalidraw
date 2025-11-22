/**
 * AI-related actions for image-to-diagram conversion
 */

import { register } from "./register";
import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { aiConfigDialogOpenAtom, imageToMermaidDialogOpenAtom } from "../editor-jotai";
import { editorJotaiStore } from "../editor-jotai";

/**
 * Action to open AI Configuration Dialog
 */
export const actionConfigureAI = register({
  name: "configureAI",
  label: "Configure AI",
  trackEvent: { category: "menu", action: "configure" },
  perform: (_elements, appState) => {
    // Open AI configuration dialog
    editorJotaiStore.set(aiConfigDialogOpenAtom, true);

    return {
      appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.A,
});

/**
 * Action to open Image Import Dialog
 */
export const actionImportImage = register({
  name: "importImage",
  label: "Import Image to Diagram",
  trackEvent: { category: "menu", action: "import-image" },
  perform: (_elements, appState) => {
    // Open image import dialog
    editorJotaiStore.set(imageToMermaidDialogOpenAtom, true);

    return {
      appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === KEYS.I,
});
