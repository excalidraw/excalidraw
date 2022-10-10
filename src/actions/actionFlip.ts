import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { mutateElement } from "../element/mutateElement";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { normalizeAngle, resizeSingleElement } from "../element/resizeElements";
import { AppState } from "../types";
import { getTransformHandles } from "../element/transformHandles";
import { updateBoundElements } from "../element/binding";
import { arrayToMap } from "../utils";
import { getResizedElementAbsoluteCoords } from "../element/bounds";

const enableActionFlipHorizontal = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const eligibleElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  return eligibleElements.length === 1 && eligibleElements[0].type !== "text";
};

const enableActionFlipVertical = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const eligibleElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  return eligibleElements.length === 1;
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
  contextItemPredicate: (elements, appState) =>
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
  keyTest: (event) => event.shiftKey && event.code === "KeyV",
  contextItemLabel: "labels.flipVertical",
  contextItemPredicate: (elements, appState) =>
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

  // remove once we allow for groups of elements to be flipped
  if (selectedElements.length > 1) {
    return elements;
  }

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
  elements.forEach((element) => {
    flipElement(element, appState);
    // If vertical flip, rotate an extra 180
    if (flipDirection === "vertical") {
      rotateElement(element, Math.PI);
    }
  });
  return elements;
};

const flipElement = (
  element: NonDeleted<ExcalidrawElement>,
  appState: AppState,
) => {
  const originalX = element.x;
  const originalY = element.y;
  const width = element.width;
  const height = element.height;
  const originalAngle = normalizeAngle(element.angle);

  // Rotate back to zero, if necessary
  mutateElement(element, {
    angle: normalizeAngle(0),
  });
  // Flip unrotated by pulling TransformHandle to opposite side
  const transformHandles = getTransformHandles(element, appState.zoom);
  let usingNWHandle = true;
  let nHandle = transformHandles.nw;
  if (!nHandle) {
    // Use ne handle instead
    usingNWHandle = false;
    nHandle = transformHandles.ne;
    if (!nHandle) {
      mutateElement(element, {
        angle: originalAngle,
      });
      return;
    }
  }

  const [axTopLeft, ayTopLeft] = getResizedElementAbsoluteCoords(
    element,
    width,
    height,
    true,
  );

  resizeSingleElement(
    new Map().set(element.id, element),
    false,
    element,
    usingNWHandle ? "nw" : "ne",
    false,
    usingNWHandle ? axTopLeft + width * 2 : ayTopLeft - width * 2,
    ayTopLeft,
  );

  // Rotate by (360 degrees - original angle)
  let angle = normalizeAngle(2 * Math.PI - originalAngle);
  if (angle < 0) {
    // check, probably unnecessary
    angle = normalizeAngle(angle + 2 * Math.PI);
  }
  mutateElement(element, {
    angle,
  });

  // Move back to original spot to appear "flipped in place"
  mutateElement(element, {
    x: originalX,
    y: originalY,
  });

  updateBoundElements(element);
};

const rotateElement = (element: ExcalidrawElement, rotationAngle: number) => {
  const originalX = element.x;
  const originalY = element.y;
  let angle = normalizeAngle(element.angle + rotationAngle);
  if (angle < 0) {
    // check, probably unnecessary
    angle = normalizeAngle(2 * Math.PI + angle);
  }
  mutateElement(element, {
    angle,
  });

  // Move back to original spot
  mutateElement(element, {
    x: originalX,
    y: originalY,
  });
};
