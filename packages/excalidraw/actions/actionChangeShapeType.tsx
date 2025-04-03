import { newElementWith } from "@excalidraw/element/mutateElement";

import { isTextElement } from "@excalidraw/element/typeChecks";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ShapeType } from "@excalidraw/element/src/types";

import { CaptureUpdateAction } from "../store";

import { register } from "./register";

import type { AppState } from "../types";

import type { ActionResult } from "./types";

const SUPPORTED_TYPES: ShapeType[] = ["rectangle", "diamond", "ellipse"];

const isShapeTypeSupported = (
  element: ExcalidrawElement,
): element is ExcalidrawElement & { type: ShapeType } => {
  return SUPPORTED_TYPES.includes(element.type as ShapeType);
};

export const actionChangeShapeType = register({
  name: "changeShapeType",
  label: "Change shape type",
  trackEvent: { category: "element" },
  perform: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    targetType: ShapeType,
  ): ActionResult => {
    // restrict the shape type to rectangle, diamond, ellipse
    const selectedElements = elements.filter(
      (el) => appState.selectedElementIds[el.id],
    );

    // If no elements are selected, return false
    if (selectedElements.length === 0) {
      return false;
    }

    // Filter out elements that can be converted to the target shape type
    const convertibleElements = selectedElements.filter(isShapeTypeSupported);

    // If no convertible elements, return false
    if (convertibleElements.length === 0) {
      return false;
    }

    // Create a map of element IDs that should be converted
    const elementsToConvert = new Set(
      convertibleElements
        .filter((element) => element.type !== targetType) // Skip elements already of target type
        .map((element) => element.id),
    );

    // If all elements are already the target type, return false
    if (elementsToConvert.size === 0) {
      return false;
    }

    // Map through all elements and convert the ones that need to be converted
    const newElements = elements.map((el) => {
      if (elementsToConvert.has(el.id)) {
        // don't convert text to other shapes
        if (isTextElement(el)) {
          return el;
        }

        // Default case: just change the type
        return newElementWith(el, {
          type: targetType,
        });
      }
      return el;
    });

    return {
      elements: newElements,
      appState: { ...appState },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event: KeyboardEvent | React.KeyboardEvent<Element>) => {
    // Handle R/D/E with Ctrl/Cmd modifier
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      return key === "r" || key === "d" || key === "e";
    }
    return false;
  },
});
