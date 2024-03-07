import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import {
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "../element/types";
import { resizeMultipleElements } from "../element/resizeElements";
import { AppState } from "../types";
import { arrayToMap } from "../utils";
import { CODES, KEYS } from "../keys";
import { getCommonBoundingBox } from "../element/bounds";
import {
  bindOrUnbindSelectedElements,
  isBindingEnabled,
  unbindLinearElements,
} from "../element/binding";
import { updateFrameMembershipOfSelectedElements } from "../frame";
import { StoreAction } from "./types";

export const actionFlipHorizontal = register({
  name: "flipHorizontal",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      elements: updateFrameMembershipOfSelectedElements(
        flipSelectedElements(
          elements,
          app.scene.getNonDeletedElementsMap(),
          appState,
          "horizontal",
        ),
        appState,
        app,
      ),
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) => event.shiftKey && event.code === CODES.H,
  contextItemLabel: "labels.flipHorizontal",
});

export const actionFlipVertical = register({
  name: "flipVertical",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      elements: updateFrameMembershipOfSelectedElements(
        flipSelectedElements(
          elements,
          app.scene.getNonDeletedElementsMap(),
          appState,
          "vertical",
        ),
        appState,
        app,
      ),
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) =>
    event.shiftKey && event.code === CODES.V && !event[KEYS.CTRL_OR_CMD],
  contextItemLabel: "labels.flipVertical",
});

const flipSelectedElements = (
  elements: readonly ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Readonly<AppState>,
  flipDirection: "horizontal" | "vertical",
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
    {
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    },
  );

  const updatedElements = flipElements(
    selectedElements,
    elements,
    elementsMap,
    appState,
    flipDirection,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return elements.map(
    (element) => updatedElementsMap.get(element.id) || element,
  );
};

const flipElements = (
  selectedElements: NonDeleted<ExcalidrawElement>[],
  elements: readonly ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: AppState,
  flipDirection: "horizontal" | "vertical",
): ExcalidrawElement[] => {
  const { minX, minY, maxX, maxY } = getCommonBoundingBox(selectedElements);

  resizeMultipleElements(
    elementsMap,
    selectedElements,
    elementsMap,
    "nw",
    true,
    flipDirection === "horizontal" ? maxX : minX,
    flipDirection === "horizontal" ? minY : maxY,
  );

  isBindingEnabled(appState)
    ? bindOrUnbindSelectedElements(selectedElements, elements, elementsMap)
    : unbindLinearElements(selectedElements, elementsMap);

  return selectedElements;
};
