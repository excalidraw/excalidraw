import { CODES, KEYS, arrayToMap } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  deepCopyElement,
  getBoundTextElement,
  isArrowElement,
  isElbowArrow,
  isFrameLikeElement,
  resizeSingleElement,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";

import { announce } from "../a11y";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

const RESIZE_STEP = 10;
const ROTATE_STEP_DEGREES = 15;
const MIN_SIZE = 10;

const canKeyboardResize = (element: ExcalidrawElement) =>
  !element.locked && !isElbowArrow(element);

const keyboardResize = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  deltaWidth: number,
  deltaHeight: number,
) => {
  const selectedElements = getSelectedElements(elements, appState).filter(
    canKeyboardResize,
  );

  for (const element of selectedElements) {
    const origElement = deepCopyElement(element);
    const boundText = getBoundTextElement(
      element,
      app.scene.getNonDeletedElementsMap(),
    );
    const originalElementsMap = arrayToMap(
      boundText ? [origElement, deepCopyElement(boundText)] : [origElement],
    );

    resizeSingleElement(
      Math.max(MIN_SIZE, element.width + deltaWidth),
      Math.max(MIN_SIZE, element.height + deltaHeight),
      element,
      origElement,
      originalElementsMap,
      app.scene,
      "se",
    );
  }

  if (selectedElements.length) {
    const primary = selectedElements[0];
    announce(
      t("a11y.resized", {
        width: Math.round(primary.width),
        height: Math.round(primary.height),
      }),
      { coalesceKey: "a11y-resize", coalesceDelay: 500 },
    );
  }

  return {
    elements,
    appState,
    captureUpdate: selectedElements.length
      ? CaptureUpdateAction.IMMEDIATELY
      : CaptureUpdateAction.EVENTUALLY,
  };
};

const resizeKeyTest =
  (key: string) => (event: React.KeyboardEvent | KeyboardEvent) =>
    event.key === key &&
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD];

const hasKeyboardResizableSelection = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
) => getSelectedElements(elements, appState).some(canKeyboardResize);

export const actionA11yIncreaseWidth = register({
  name: "a11yIncreaseWidth",
  label: "labels.increaseWidth",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    hasKeyboardResizableSelection(elements, appState),
  perform: (elements, appState, _, app) =>
    keyboardResize(elements, appState, app, RESIZE_STEP, 0),
  keyTest: resizeKeyTest(KEYS.ARROW_RIGHT),
});

export const actionA11yDecreaseWidth = register({
  name: "a11yDecreaseWidth",
  label: "labels.decreaseWidth",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    hasKeyboardResizableSelection(elements, appState),
  perform: (elements, appState, _, app) =>
    keyboardResize(elements, appState, app, -RESIZE_STEP, 0),
  keyTest: resizeKeyTest(KEYS.ARROW_LEFT),
});

export const actionA11yIncreaseHeight = register({
  name: "a11yIncreaseHeight",
  label: "labels.increaseHeight",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    hasKeyboardResizableSelection(elements, appState),
  perform: (elements, appState, _, app) =>
    keyboardResize(elements, appState, app, 0, RESIZE_STEP),
  keyTest: resizeKeyTest(KEYS.ARROW_DOWN),
});

export const actionA11yDecreaseHeight = register({
  name: "a11yDecreaseHeight",
  label: "labels.decreaseHeight",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    hasKeyboardResizableSelection(elements, appState),
  perform: (elements, appState, _, app) =>
    keyboardResize(elements, appState, app, 0, -RESIZE_STEP),
  keyTest: resizeKeyTest(KEYS.ARROW_UP),
});

const canKeyboardRotate = (element: ExcalidrawElement) =>
  !element.locked && !isFrameLikeElement(element) && !isElbowArrow(element);

const keyboardRotate = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
  deltaDegrees: number,
) => {
  const selectedElements = getSelectedElements(elements, appState).filter(
    canKeyboardRotate,
  );

  for (const element of selectedElements) {
    const nextAngle =
      ((element.angle * 180) / Math.PI + deltaDegrees + 360) % 360;
    const nextAngleRadians = ((nextAngle * Math.PI) / 180) as Radians;
    app.scene.mutateElement(element, { angle: nextAngleRadians });

    const boundText = getBoundTextElement(
      element,
      app.scene.getNonDeletedElementsMap(),
    );
    if (boundText && !isArrowElement(element)) {
      app.scene.mutateElement(boundText, { angle: nextAngleRadians });
    }
  }

  if (selectedElements.length) {
    announce(
      t("a11y.rotated", {
        degrees: Math.round((selectedElements[0].angle * 180) / Math.PI),
      }),
      { coalesceKey: "a11y-rotate", coalesceDelay: 500 },
    );
  }

  return {
    elements,
    appState,
    captureUpdate: selectedElements.length
      ? CaptureUpdateAction.IMMEDIATELY
      : CaptureUpdateAction.EVENTUALLY,
  };
};

const hasKeyboardRotatableSelection = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
) => getSelectedElements(elements, appState).some(canKeyboardRotate);

export const actionA11yRotateCW = register({
  name: "a11yRotateCW",
  label: "labels.rotateClockwise",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    hasKeyboardRotatableSelection(elements, appState),
  perform: (elements, appState, _, app) =>
    keyboardRotate(elements, appState, app, ROTATE_STEP_DEGREES),
  keyTest: (event) =>
    event.code === CODES.R &&
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionA11yRotateCCW = register({
  name: "a11yRotateCCW",
  label: "labels.rotateCounterClockwise",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    hasKeyboardRotatableSelection(elements, appState),
  perform: (elements, appState, _, app) =>
    keyboardRotate(elements, appState, app, -ROTATE_STEP_DEGREES),
  keyTest: (event) =>
    event.code === "KeyE" &&
    event.altKey &&
    event.shiftKey &&
    !event[KEYS.CTRL_OR_CMD],
});
