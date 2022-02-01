import { getNonDeletedElements, isTextElement } from "../element";
import { mutateElement } from "../element/mutateElement";
import { hasBoundTextElement } from "../element/typeChecks";
import {
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "../element/types";
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
      if (hasBoundTextElement(element)) {
        mutateElement(element, {
          boundElements: element.boundElements?.filter(
            (ele) =>
              !isTextElement(
                ele as ExcalidrawTextElement | ExcalidrawLinearElement,
              ),
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
