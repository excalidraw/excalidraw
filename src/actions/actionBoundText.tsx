import { VERTICAL_ALIGN } from "../constants";
import { getNonDeletedElements } from "../element";
import { getClosestBindableContainer } from "../element/collision";
import { mutateElement } from "../element/mutateElement";
import {
  getBoundTextElement,
  measureText,
  redrawTextBoundingBox,
} from "../element/textElement";
import {
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
} from "../element/types";
import { getSelectedElements } from "../scene";
import { getFontString } from "../utils";
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

export const actionBindText = register({
  name: "bindText",
  contextItemLabel: "labels.bindText",
  perform: (elements, appState) => {
    const textElement = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    )[0] as ExcalidrawTextElement;
    const closestContainer = getClosestBindableContainer(
      textElement,
      elements,
    )! as ExcalidrawTextContainer;
    mutateElement(textElement, {
      containerId: closestContainer.id,
      verticalAlign: VERTICAL_ALIGN.MIDDLE,
    });
    mutateElement(closestContainer, {
      boundElements: (closestContainer.boundElements || []).concat({
        type: "text",
        id: textElement.id,
      }),
    });
    redrawTextBoundingBox(textElement, closestContainer);
    const updatedElements = elements.slice();
    const textElementIndex = updatedElements.findIndex(
      (ele) => ele.id === textElement.id,
    );
    updatedElements.splice(textElementIndex, 1);
    const containerIndex = updatedElements.findIndex(
      (ele) => ele.id === closestContainer.id,
    );
    updatedElements.splice(containerIndex + 1, 0, textElement);
    return {
      elements: updatedElements,
      appState,
      commitToHistory: true,
    };
  },
});
