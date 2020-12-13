import { register } from "./register";
import { getSelectedElements } from "../scene";
import { getElementMap, getNonDeletedElements } from "../element";
import { mutateElement } from "../element/mutateElement";
import { ExcalidrawElement, NonDeleted } from "../element/types";
import {
  normalizeAngle,
  resizeSingleGenericElement,
  resizeSingleNonGenericElement,
} from "../element/resizeElements";
import { AppState } from "../types";
import { getTransformHandles } from "../element/transformHandles";
import { isGenericElement, isLinearElement } from "../element/typeChecks";

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
  contextMenuOrder: 8,
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
  contextMenuOrder: 8,
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

  const updatedElements = flipElements(
    selectedElements,
    appState,
    flipDirection,
  );

  const updatedElementsMap = getElementMap(updatedElements);

  return elements.map((element) => updatedElementsMap[element.id] || element);
};

const flipElements = (
  elements: NonDeleted<ExcalidrawElement>[],
  appState: AppState,
  flipDirection: "horizontal" | "vertical",
): ExcalidrawElement[] => {
  for (let i = 0; i < elements.length; i++) {
    flipElementHorizontally(elements[i], appState);
    // If vertical flip, rotate an extra 180
    if (flipDirection === "vertical") {
      rotateElement(elements[i], Math.PI);
    }
  }
  return elements;
};

const flipElementHorizontally = (
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
  let sHandle = transformHandles.se;
  let xHandleDistance = 0;
  let [newNCoordsX, newNCoordsY] = [0, 0];
  if (!nHandle || !sHandle) {
    // Check if we can use ne and sw handles
    usingNWHandle = false;
    nHandle = transformHandles.ne;
    sHandle = transformHandles.sw;
    if (!nHandle || !sHandle) {
      mutateElement(element, {
        angle: originalAngle,
      });
      return;
    }
    [newNCoordsX, newNCoordsY] = [nHandle[0], nHandle[1]];
    xHandleDistance = Math.abs(nHandle[0] - sHandle[0]);
    newNCoordsX = nHandle[0] - 2 * xHandleDistance;
  } else {
    [newNCoordsX, newNCoordsY] = [nHandle[0], nHandle[1]];
    xHandleDistance = Math.abs(nHandle[0] - sHandle[0]);
    newNCoordsX = nHandle[0] + 2 * xHandleDistance;
  }

  if (isGenericElement(element)) {
    resizeSingleGenericElement(
      element,
      false,
      element,
      usingNWHandle ? "nw" : "ne",
      false,
      newNCoordsX,
      newNCoordsY,
    );
  } else {
    resizeSingleNonGenericElement(
      element,
      usingNWHandle ? "nw" : "ne",
      false,
      false,
      newNCoordsX,
      newNCoordsY,
    );
  }

  // Rotate by (360 degrees - original angle)
  let angle = normalizeAngle(2 * Math.PI - originalAngle);
  if (angle < 0) {
    // check, probably unnecessary
    angle = normalizeAngle(angle + 2 * Math.PI);
  }
  mutateElement(element, {
    width,
    height,
    angle,
  });

  if (element.width < 0) {
    mutateElement(element, { width: -width });
  }
  if (element.height < 0) {
    mutateElement(element, { height: -height });
  }
  // Move back to original spot
  if (isLinearElement(element) && element.type !== "draw") {
    const newX = usingNWHandle
      ? originalX - xHandleDistance
      : originalX + xHandleDistance;
    mutateElement(element, {
      x: newX,
      y: originalY,
    });
  } else {
    mutateElement(element, {
      x: originalX,
      y: originalY,
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
