import { CaptureUpdateAction, isImageElement } from "@excalidraw/element";

import { imageAltTextDialogAtom } from "../a11y/ImageAltTextDialog";
import { editorJotaiStore } from "../editor-jotai";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionImageAltText = register({
  name: "imageAltText",
  label: "labels.imageAltText",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    return selected.length === 1 && isImageElement(selected[0]);
  },
  perform: (elements, appState) => {
    const selected = getSelectedElements(elements, appState);
    if (selected.length === 1 && isImageElement(selected[0])) {
      editorJotaiStore.set(imageAltTextDialogAtom, {
        elementId: selected[0].id,
      });
    }
    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
