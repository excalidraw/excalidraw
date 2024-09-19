import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "../element/types";
import { resizeMultipleElements } from "../element/resizeElements";
import type { AppClassProperties, AppState } from "../types";
import { arrayToMap } from "../utils";
import { CODES, KEYS } from "../keys";
import { getCommonBoundingBox } from "../element/bounds";
import {
  bindOrUnbindLinearElements,
  isBindingEnabled,
} from "../element/binding";
import { updateFrameMembershipOfSelectedElements } from "../frame";
import { flipHorizontal, flipVertical } from "../components/icons";
import { StoreAction } from "../store";
import {
  isArrowElement,
  isElbowArrow,
  isLinearElement,
} from "../element/typeChecks";
import { mutateElbowArrow } from "../element/routing";
import { mutateElement, newElementWith } from "../element/mutateElement";

export const actionFlipHorizontal = register({
  name: "flipHorizontal",
  label: "labels.flipHorizontal",
  icon: flipHorizontal,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      elements: updateFrameMembershipOfSelectedElements(
        flipSelectedElements(
          elements,
          app.scene.getNonDeletedElementsMap(),
          appState,
          "horizontal",
          app,
        ),
        appState,
        app,
      ),
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) => event.shiftKey && event.code === CODES.H,
});

export const actionFlipVertical = register({
  name: "flipVertical",
  label: "labels.flipVertical",
  icon: flipVertical,
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    return {
      elements: updateFrameMembershipOfSelectedElements(
        flipSelectedElements(
          elements,
          app.scene.getNonDeletedElementsMap(),
          appState,
          "vertical",
          app,
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
});

const flipSelectedElements = (
  elements: readonly ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: Readonly<AppState>,
  flipDirection: "horizontal" | "vertical",
  app: AppClassProperties,
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
    elementsMap,
    appState,
    flipDirection,
    app,
  );

  const updatedElementsMap = arrayToMap(updatedElements);

  return elements.map(
    (element) => updatedElementsMap.get(element.id) || element,
  );
};

const flipElements = (
  selectedElements: NonDeleted<ExcalidrawElement>[],
  elementsMap: NonDeletedSceneElementsMap,
  appState: AppState,
  flipDirection: "horizontal" | "vertical",
  app: AppClassProperties,
): ExcalidrawElement[] => {
  if (
    selectedElements.every(
      (element) =>
        isArrowElement(element) && (element.startBinding || element.endBinding),
    )
  ) {
    return selectedElements.map((element) => {
      const _element = element as ExcalidrawArrowElement;
      return newElementWith(_element, {
        startArrowhead: _element.endArrowhead,
        endArrowhead: _element.startArrowhead,
      });
    });
  }

  const { minX, minY, maxX, maxY, midX, midY } =
    getCommonBoundingBox(selectedElements);

  resizeMultipleElements(
    elementsMap,
    selectedElements,
    elementsMap,
    "nw",
    true,
    true,
    flipDirection === "horizontal" ? maxX : minX,
    flipDirection === "horizontal" ? minY : maxY,
  );

  bindOrUnbindLinearElements(
    selectedElements.filter(isLinearElement),
    elementsMap,
    app.scene.getNonDeletedElements(),
    app.scene,
    isBindingEnabled(appState),
    [],
  );

  // ---------------------------------------------------------------------------
  // flipping arrow elements (and potentially other) makes the selection group
  // "move" across the canvas because of how arrows can bump against the "wall"
  // of the selection, so we need to center the group back to the original
  // position so that repeated flips don't accumulate the offset

  const { elbowArrows, otherElements } = selectedElements.reduce(
    (
      acc: {
        elbowArrows: ExcalidrawElbowArrowElement[];
        otherElements: ExcalidrawElement[];
      },
      element,
    ) =>
      isElbowArrow(element)
        ? { ...acc, elbowArrows: acc.elbowArrows.concat(element) }
        : { ...acc, otherElements: acc.otherElements.concat(element) },
    { elbowArrows: [], otherElements: [] },
  );

  const { midX: newMidX, midY: newMidY } =
    getCommonBoundingBox(selectedElements);
  const [diffX, diffY] = [midX - newMidX, midY - newMidY];
  otherElements.forEach((element) =>
    mutateElement(element, {
      x: element.x + diffX,
      y: element.y + diffY,
    }),
  );
  elbowArrows.forEach((element) =>
    mutateElbowArrow(
      element,
      elementsMap,
      element.points,
      undefined,
      undefined,
      {
        informMutation: false,
      },
    ),
  );
  // ---------------------------------------------------------------------------

  return selectedElements;
};
