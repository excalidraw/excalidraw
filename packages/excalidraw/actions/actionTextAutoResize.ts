import { getFontString } from "@excalidraw/common";

import { isExcalidrawElement, newElementWith } from "@excalidraw/element";
import { measureText } from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionTextAutoResize = register({
  name: "autoResize",
  label: "labels.autoResize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      !selectedElements[0].autoResize
    );
  },
  perform: (elements, appState, targetElement) => {
    const selectedElements = getSelectedElements(elements, appState);

    const targetTextElement =
      isExcalidrawElement(targetElement) && isTextElement(targetElement)
        ? targetElement
        : (selectedElements[0] as ExcalidrawElement | undefined);

    return {
      appState,
      elements: elements.map((element) => {
        if (element.id === targetTextElement?.id && isTextElement(element)) {
          const metrics = measureText(
            element.originalText,
            getFontString(element),
            element.lineHeight,
          );

          return newElementWith(element, {
            autoResize: true,
            width: metrics.width,
            height: metrics.height,
            text: element.originalText,
          });
        }
        return element;
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
