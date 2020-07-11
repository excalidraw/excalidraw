import rough from "roughjs/bin/rough";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../../element/types";
import { getNonDeletedElements } from "../../element";
import { deleteSelectedElements } from "../actionDeleteSelected";
import { AppState } from "../../types";
import { operateBool } from "../../element";

interface SelectedElements {
  elements: readonly NonDeletedExcalidrawElement[];
  firstSelectedIndex: number;
}

export function getSelectedElements(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) {
  const nonDeletedElements = getNonDeletedElements(elements);
  const selectedElements = {} as SelectedElements;
  selectedElements.firstSelectedIndex = -1;

  selectedElements.elements = nonDeletedElements.filter(({ id }, i) => {
    if (appState.selectedElementIds[id]) {
      if (selectedElements.firstSelectedIndex === -1) {
        selectedElements.firstSelectedIndex = i;
      }

      return true;
    }

    return false;
  });

  return selectedElements;
}

export function isBoolable(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): boolean {
  const selectedElements = getSelectedElements(elements, appState);

  return (
    selectedElements.elements.length > 1 &&
    selectedElements.elements.every((element: ExcalidrawElement) => {
      if (["arrow", "text"].includes(element.type)) {
        return false;
      }

      if (element.type === "line") {
        const first = element.points[0];
        const last = element.points[element.points.length - 1];

        return first[0] === last[0] && first[1] === last[1];
      }

      return true;
    })
  );
}

export function performShapeBool(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  action: "difference" | "union" | "intersection" | "exclusion",
) {
  const canvas = document.createElement("canvas");
  const rc = rough.canvas(canvas);
  const selectedElements = getSelectedElements(elements, appState);

  const newElement = selectedElements.elements.reduce(
    (
      acc: NonDeletedExcalidrawElement,
      element: NonDeletedExcalidrawElement,
    ) => {
      if (!acc) {
        return element;
      }

      return operateBool(acc, element, rc, action);
    },
  );

  const {
    elements: nextElements,
    appState: nextAppState,
  } = deleteSelectedElements(elements, appState);

  if (newElement) {
    nextElements.splice(selectedElements.firstSelectedIndex, 0, newElement);
  }

  return {
    nextElements,
    nextAppState,
  };
}
