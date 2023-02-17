import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { resizeMultipleElements } from "../element/resizeElements";
import { AppState, PointerDownState } from "../types";
import { updateBoundElements } from "../element/binding";
import { arrayToMap } from "../utils";
import { KEYS } from "../keys";
import {
  getCommonBoundingBox,
  getElementPointsCoords,
} from "../element/bounds";
import { isLinearElement } from "../element/typeChecks";
import { type ExcalidrawLinearElement } from "../element/types";
import { mutateElement } from "../element/mutateElement";

const enableActionFlipHorizontal = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return true;
};

const enableActionFlipVertical = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return true;
};

export const actionFlipHorizontal = register({
  name: "flipHorizontal",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: flipSelectedElements(elements, appState, "horizontal"),
      appState,
      commitToHistory: true,
    };
  },
  keyTest: (event) => event.shiftKey && event.code === "KeyH",
  contextItemLabel: "labels.flipHorizontal",
  predicate: (elements, appState) =>
    enableActionFlipHorizontal(elements, appState),
});

export const actionFlipVertical = register({
  name: "flipVertical",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: flipSelectedElements(elements, appState, "vertical"),
      appState,
      commitToHistory: true,
    };
  },
  keyTest: (event) =>
    event.shiftKey && event.code === "KeyV" && !event[KEYS.CTRL_OR_CMD],
  contextItemLabel: "labels.flipVertical",
  predicate: (elements, appState) =>
    enableActionFlipVertical(elements, appState),
});

const flipSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  flipDirection: "horizontal" | "vertical",
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );

  const updatedElements = flipElements(
    selectedElements,
    appState,
    flipDirection,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return elements.map(
    (element) => updatedElementsMap.get(element.id) || element,
  );
};

const flipElements = (
  elements: NonDeleted<ExcalidrawElement>[],
  appState: AppState,
  flipDirection: "horizontal" | "vertical",
): ExcalidrawElement[] => {
  const { minX, minY, maxX, maxY } = getCommonBoundingBox(elements);

  const linearElements = elements
    .filter((element): element is ExcalidrawLinearElement =>
      isLinearElement(element),
    )
    .map((element) => {
      const origCoords = getElementPointsCoords(element, element.points);
      return [element, origCoords] as const;
    });

  resizeMultipleElements(
    { originalElements: arrayToMap(elements) } as PointerDownState,
    elements,
    "nw",
    true,
    flipDirection === "horizontal" ? maxX : minX,
    flipDirection === "horizontal" ? minY : maxY,
  );

  linearElements.forEach(([element, origCoords]) => {
    const latestCoords = getElementPointsCoords(element, element.points);
    const coordsDiffX =
      origCoords[0] - latestCoords[0] + origCoords[2] - latestCoords[2];
    const coordsDiffY =
      origCoords[1] - latestCoords[1] + origCoords[3] - latestCoords[3];

    mutateElement(element, {
      x: element.x + coordsDiffX * 0.5,
      y: element.y + coordsDiffY * 0.5,
    });
  });

  elements.forEach((element) => updateBoundElements(element));

  return elements;
};
