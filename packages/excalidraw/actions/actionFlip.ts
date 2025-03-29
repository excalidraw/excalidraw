import { getNonDeletedElements } from "@excalidraw/element";
import {
  bindOrUnbindLinearElement,
  isBindingEnabled,
} from "@excalidraw/element/binding";
import { getCommonBoundingBox } from "@excalidraw/element/bounds";
import {
  mutateElement,
  newElementWith,
} from "@excalidraw/element/mutateElement";
import { deepCopyElement } from "@excalidraw/element/duplicate";
import { resizeMultipleElements } from "@excalidraw/element/resizeElements";
import {
  isArrowElement,
  isBindableElement,
  isBindingElement,
} from "@excalidraw/element/typeChecks";
import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element/frame";
import { CODES, KEYS, arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";
import { CaptureUpdateAction } from "../store";

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

  const selectedBindables = selectedElements.filter(
    (e): e is ExcalidrawBindableElement => isBindableElement(e),
  );
  const { midX: newMidX, midY: newMidY } =
    getCommonBoundingBox(selectedElements);
  const [diffX, diffY] = [midX - newMidX, midY - newMidY];

  selectedElements.forEach((element) => {
    fixBindings(element, selectedBindables, app, elementsMap);

    mutateElement(element, {
      x: element.x + diffX,
      y: element.y + diffY,
    });
  });

  return selectedElements;
};

// BEHAVIOR: If you flip a binding element along with its bound elements,
// the binding should be preserved. If your selected elements doesn't contain
// the bound element(s), then remove the binding. Also do not "magically"
// re-bind a binable just because the arrow endpoint is flipped into the
// binding range. Rationale being the consistency with the fact that arrows
// don't bind when the arrow is moved into the binding range by its shaft.
const fixBindings = (
  element: ExcalidrawElement,
  selectedBindables: ExcalidrawBindableElement[],
  app: AppClassProperties,
  elementsMap: NonDeletedSceneElementsMap,
) => {
  if (isBindingElement(element)) {
    let start = null;
    let end = null;

    if (isBindingEnabled(app.state)) {
      start = element.startBinding
        ? selectedBindables.find(
            (e) => element.startBinding!.elementId === e.id,
          ) ?? null
        : null;
      end = element.endBinding
        ? selectedBindables.find(
            (e) => element.endBinding!.elementId === e.id,
          ) ?? null
        : null;
    }

    bindOrUnbindLinearElement(element, start, end, elementsMap, app.scene);
  }
};
