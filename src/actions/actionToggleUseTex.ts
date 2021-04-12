// Action for toggling useTex
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { getSelectedElements } from "../scene";
import {
  getElementMap,
  getNonDeletedElements,
  isTextElement,
} from "../element";
import { mutateElement } from "../element/mutateElement";
import { invalidateShapeForElement } from "../renderer/renderElement";
import {
  containsMath,
  isMathMode,
  measureMath,
  setUseTex,
  toggleUseTex,
} from "../mathmode";
import { getFontString } from "../utils";

const enableActionToggleUseTex = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const eligibleElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );

  let enabled = false;
  eligibleElements.forEach((element) => {
    // Only operate on selected elements which are text elements in
    // math made containing math content.
    if (
      isTextElement(element) &&
      isMathMode(getFontString(element)) &&
      (containsMath(element.text, element.useTex) ||
        containsMath(element.text, !element.useTex))
    ) {
      enabled = true;
    }
  });

  return enabled;
};

export const actionToggleUseTex = register({
  name: "toggleUseTex",
  perform: (elements, appState) => {
    return {
      elements: toggleUseTexForSelectedElements(elements, appState),
      appState,
      commitToHistory: true,
    };
  },
  keyTest: (event) => event.ctrlKey && event.shiftKey && event.code === "KeyM",
  contextItemLabel: "labels.toggleUseTex",
  contextItemPredicate: (elements, appState) =>
    enableActionToggleUseTex(elements, appState),
});

const toggleUseTexForSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );

  selectedElements.forEach((element) => {
    // Only operate on selected elements which are text elements in
    // math made containing math content.
    if (
      isTextElement(element) &&
      isMathMode(getFontString(element)) &&
      (containsMath(element.text, element.useTex) ||
        containsMath(element.text, !element.useTex))
    ) {
      toggleUseTex(element);
      // Mark the element for re-rendering
      invalidateShapeForElement(element);
      // Update the width/height of the element
      const metrics = measureMath(
        element.text,
        element.fontSize,
        element.fontFamily,
        element.useTex,
      );
      mutateElement(element, metrics);
      // If only one element is selected, use the element's updated
      // useTex value to set the default value for new text elements.
      if (selectedElements.length === 1) {
        setUseTex(element.useTex);
      }
    }
  });
  const updatedElementsMap = getElementMap(elements);

  return elements.map((element) => updatedElementsMap[element.id] || element);
};
