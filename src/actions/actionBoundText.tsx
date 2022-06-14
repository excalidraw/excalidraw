import { VERTICAL_ALIGN } from "../constants";
import { getNonDeletedElements, isTextElement } from "../element";
import { mutateElement } from "../element/mutateElement";
import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "../element/textElement";
import { measureTextElement } from "../element/textWysiwyg";
import {
  hasBoundTextElement,
  isTextBindableContainer,
} from "../element/typeChecks";
import {
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
} from "../element/types";
import { getSelectedElements } from "../scene";
import { register } from "./register";

export const actionUnbindText = register({
  name: "unbindText",
  contextItemLabel: "labels.unbindText",
  trackEvent: { category: "element" },
  contextItemPredicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    return selectedElements.some((element) => hasBoundTextElement(element));
  },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    selectedElements.forEach((element) => {
      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        const { width, height, baseline } =
          measureTextElement(boundTextElement);
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

export const actionBindText = register({
  name: "bindText",
  contextItemLabel: "labels.bindText",
  trackEvent: { category: "element" },
  contextItemPredicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);

    if (selectedElements.length === 2) {
      const textElement =
        isTextElement(selectedElements[0]) ||
        isTextElement(selectedElements[1]);

      let bindingContainer;
      if (isTextBindableContainer(selectedElements[0])) {
        bindingContainer = selectedElements[0];
      } else if (isTextBindableContainer(selectedElements[1])) {
        bindingContainer = selectedElements[1];
      }
      if (
        textElement &&
        bindingContainer &&
        getBoundTextElement(bindingContainer) === null
      ) {
        return true;
      }
    }
    return false;
  },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    let textElement: ExcalidrawTextElement;
    let container: ExcalidrawTextContainer;

    if (
      isTextElement(selectedElements[0]) &&
      isTextBindableContainer(selectedElements[1])
    ) {
      textElement = selectedElements[0];
      container = selectedElements[1];
    } else {
      textElement = selectedElements[1] as ExcalidrawTextElement;
      container = selectedElements[0] as ExcalidrawTextContainer;
    }
    mutateElement(textElement, {
      containerId: container.id,
      verticalAlign: VERTICAL_ALIGN.MIDDLE,
    });
    mutateElement(container, {
      boundElements: (container.boundElements || []).concat({
        type: "text",
        id: textElement.id,
      }),
    });
    redrawTextBoundingBox(textElement, container);
    const updatedElements = elements.slice();
    const textElementIndex = updatedElements.findIndex(
      (ele) => ele.id === textElement.id,
    );
    updatedElements.splice(textElementIndex, 1);
    const containerIndex = updatedElements.findIndex(
      (ele) => ele.id === container.id,
    );
    updatedElements.splice(containerIndex + 1, 0, textElement);
    return {
      elements: updatedElements,
      appState: { ...appState, selectedElementIds: { [container.id]: true } },
      commitToHistory: true,
    };
  },
});
