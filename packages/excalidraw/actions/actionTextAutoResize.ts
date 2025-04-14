import { getFontString } from "@excalidraw/common";

import { newElementWith } from "@excalidraw/element/mutateElement";
import { measureText } from "@excalidraw/element/textMeasurements";

import { isTextElement } from "@excalidraw/element/typeChecks";

import { getSelectedElements } from "../scene";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

import type { AppClassProperties } from "../types";

export const actionTextAutoResize = register({
  name: "autoResize",
  label: "labels.autoResize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown, app: AppClassProperties) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      !selectedElements[0].autoResize
    );
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);

    return {
      appState,
      elements: elements.map((element) => {
        if (element.id === selectedElements[0].id && isTextElement(element)) {
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
