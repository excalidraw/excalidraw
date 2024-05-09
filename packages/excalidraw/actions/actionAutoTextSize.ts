import { isTextElement } from "../element";
import { measureText } from "../element/textElement";
import { getSelectedElements } from "../scene";
import { StoreAction } from "../store";
import type { AppClassProperties } from "../types";
import { getFontString } from "../utils";
import { register } from "./register";

export const actionUnwrapText = register({
  name: "unwrapText",
  label: "labels.autoTextSize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown, app: AppClassProperties) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      selectedElements[0].autoResize === false
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

          return {
            ...element,
            autoResize: true,
            width: metrics.width,
            height: metrics.height,
            text: element.originalText,
          };
        }
        return element;
      }),
      storeAction: StoreAction.CAPTURE,
    };
  },
});
