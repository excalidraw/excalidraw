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
import {
  getElementAbsoluteCoords,
  getElementPointsCoords,
} from "../element/bounds";
import { isLinearElement } from "../element/typeChecks";
import { LinearElementEditor } from "../element/linearElementEditor";
import { KEYS } from "../keys";

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
  keyTest: (event) =>
    event.shiftKey && event.code === "KeyV" && !event[KEYS.CTRL_OR_CMD],
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

  let finalOffsetX = 0;
  if (isLinearElement(element) && element.points.length < 3) {
    finalOffsetX =
      element.points.reduce((max, point) => Math.max(max, point[0]), 0) * 2 -
      element.width;
  }

  let initialPointsCoords;
  if (isLinearElement(element)) {
    initialPointsCoords = getElementPointsCoords(element, element.points);
  }
  const initialElementAbsoluteCoords = getElementAbsoluteCoords(element);

  if (isLinearElement(element) && element.points.length < 3) {
    for (let index = 1; index < element.points.length; index++) {
      LinearElementEditor.movePoints(element, [
        {
          index,
          point: [-element.points[index][0], element.points[index][1]],
        },
      ]);
    }
    LinearElementEditor.normalizePoints(element);
  } else {
    const elWidth = initialPointsCoords
      ? initialPointsCoords[2] - initialPointsCoords[0]
      : initialElementAbsoluteCoords[2] - initialElementAbsoluteCoords[0];

    const startPoint = initialPointsCoords
      ? [initialPointsCoords[0], initialPointsCoords[1]]
      : [initialElementAbsoluteCoords[0], initialElementAbsoluteCoords[1]];

    resizeSingleElement(
      new Map().set(element.id, element),
      false,
      element,
      usingNWHandle ? "nw" : "ne",
      true,
      usingNWHandle ? startPoint[0] + elWidth : startPoint[0] - elWidth,
      startPoint[1],
    );
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
    width,
    height,
  });

  updateBoundElements(element);

  if (initialPointsCoords && isLinearElement(element)) {
    // Adjusting origin because when a beizer curve path exceeds min/max points it offsets the origin.
    // There's still room for improvement since when the line roughness is > 1
    // we still have a small offset of the origin when fliipping the element.
    const finalPointsCoords = getElementPointsCoords(element, element.points);

    const topLeftCoordsDiff = initialPointsCoords[0] - finalPointsCoords[0];
    const topRightCoordDiff = initialPointsCoords[2] - finalPointsCoords[2];

    const coordsDiff = topLeftCoordsDiff + topRightCoordDiff;

    mutateElement(element, {
      x: element.x + coordsDiff * 0.5,
      y: element.y,
      width,
      height,
    });
  }
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
