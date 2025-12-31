import { getNonDeletedElements } from "@excalidraw-modify/element";
import { bindOrUnbindBindingElements } from "@excalidraw-modify/element";
import { getCommonBoundingBox } from "@excalidraw-modify/element";
import { newElementWith } from "@excalidraw-modify/element";
import { deepCopyElement } from "@excalidraw-modify/element";
import { resizeMultipleElements } from "@excalidraw-modify/element";
import { isArrowElement, isElbowArrow } from "@excalidraw-modify/element";
import { updateFrameMembershipOfSelectedElements } from "@excalidraw-modify/element";
import { CODES, KEYS, arrayToMap } from "@excalidraw-modify/common";

import { CaptureUpdateAction } from "@excalidraw-modify/element";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw-modify/element/types";

import { getSelectedElements } from "../scene";

import { flipHorizontal, flipVertical } from "../components/icons";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

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
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
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

  const { midX, midY } = getCommonBoundingBox(selectedElements);

  resizeMultipleElements(
    selectedElements,
    elementsMap,
    "nw",
    app.scene,
    new Map(
      Array.from(elementsMap.values()).map((element) => [
        element.id,
        deepCopyElement(element),
      ]),
    ),
    {
      flipByX: flipDirection === "horizontal",
      flipByY: flipDirection === "vertical",
      shouldResizeFromCenter: true,
      shouldMaintainAspectRatio: true,
    },
  );

  bindOrUnbindBindingElements(
    selectedElements.filter(isArrowElement),
    app.scene,
    app.state,
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
    app.scene.mutateElement(element, {
      x: element.x + diffX,
      y: element.y + diffY,
    }),
  );
  elbowArrows.forEach((element) =>
    app.scene.mutateElement(element, {
      x: element.x + diffX,
      y: element.y + diffY,
    }),
  );
  // ---------------------------------------------------------------------------

  return selectedElements;
};
