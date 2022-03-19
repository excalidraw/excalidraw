import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getNonDeletedElements } from "../element";
import { mutateElement } from "../element/mutateElement";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import { normalizeAngle, resizeSingleElement } from "../element/resizeElements";
import { AppState } from "../types";
import { getTransformHandles } from "../element/transformHandles";
import { isFreeDrawElement, isLinearElement } from "../element/typeChecks";
import { updateBoundElements } from "../element/binding";
import { LinearElementEditor } from "../element/linearElementEditor";
import { arrayToMap } from "../utils";

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

  let finalOffsetX = 0;
  if (isLinearElement(element) || isFreeDrawElement(element)) {
    finalOffsetX =
      element.points.reduce((max, point) => Math.max(max, point[0]), 0) * 2 -
      element.width;
  }

  // Rotate back to zero, if necessary
  mutateElement(element, {
    angle: normalizeAngle(0),
  });
  // Flip unrotated by pulling TransformHandle to opposite side
  const transformHandles = getTransformHandles(element, appState.zoom);
  let usingNWHandle = true;
  let newNCoordsX = 0;
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

  if (isLinearElement(element)) {
    for (let index = 1; index < element.points.length; index++) {
      LinearElementEditor.movePoints(element, [
        { index, point: [-element.points[index][0], element.points[index][1]] },
      ]);
    }
    LinearElementEditor.normalizePoints(element);
  } else {
    // calculate new x-coord for transformation
    newNCoordsX = usingNWHandle ? element.x + 2 * width : element.x - 2 * width;
    resizeSingleElement(
      new Map().set(element.id, element),
      true,
      element,
      usingNWHandle ? "nw" : "ne",
      false,
      newNCoordsX,
      nHandle[1],
    );
    // fix the size to account for handle sizes
    mutateElement(element, {
      width,
      height,
    });
  }

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
    x: originalX + finalOffsetX,
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
