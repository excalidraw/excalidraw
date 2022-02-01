import { getNonDeletedElements } from "../element";
import { mutateElement } from "../element/mutateElement";
import { getBoundTextElement } from "../element/textElement";
import { ExcalidrawTextElement } from "../element/types";
import { getSelectedElements } from "../scene";
import { register } from "./register";

export const actionUnbindText = register({
  name: "unbindText",
  contextItemLabel: "labels.unbindText",
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    selectedElements.forEach((element) => {
      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        mutateElement(boundTextElement as ExcalidrawTextElement, {
          containerId: null,
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
