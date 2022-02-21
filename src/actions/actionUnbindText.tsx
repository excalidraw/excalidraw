import { getNonDeletedElements } from "../element";
import { mutateElement } from "../element/mutateElement";
import { getBoundTextElement, measureText } from "../element/textElement";
import { ExcalidrawTextElement } from "../element/types";
import { getSelectedElements } from "../scene";
import { getFontString } from "../utils";
import { register } from "./register";

export const actionUnbindText = register({
  name: "unbindText",
  contextItemLabel: "labels.unbindText",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    selectedElements.forEach((element) => {
      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        const { width, height, baseline } = measureText(
          boundTextElement.originalText,
          getFontString(boundTextElement),
        );
        mutateElement(boundTextElement as ExcalidrawTextElement, {
          containerId: null,
          width,
          height,
          baseline,
          text: boundTextElement.originalText,
        });
        mutateElement(element, {
          boundElements: element.boundElements?.filter(
            (ele) => ele.id !== boundTextElement.id,
          ),
        });
      }
    });
    return {
      elements,
      appState,
      commitToHistory: true,
    };
  },
});
