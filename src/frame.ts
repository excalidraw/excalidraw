import { getElementAbsoluteCoords } from "./element";
import { mutateElement } from "./element/mutateElement";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";

export const getElementsInFrame = (
  elements: readonly ExcalidrawElement[],
  frameId: string,
) => elements.filter((element) => element.frameId === frameId);

const addElementToFrame = (
  element: NonDeletedExcalidrawElement,
  frameId: string,
) => {
  mutateElement(element, {
    frameId,
  });
};

const removeElementFromFrame = (element: NonDeletedExcalidrawElement) => {
  mutateElement(element, {
    frameId: null,
  });
};

export const addElementsToFrame = (
  elements: NonDeletedExcalidrawElement[],
  frameId: string,
) => {
  elements.forEach((el) => addElementToFrame(el, frameId));
};

export const removeElementsFromFrame = (
  elements: NonDeletedExcalidrawElement[],
) => {
  elements.forEach((el) => removeElementFromFrame(el));
};

// TODO: include rotation
export const isCursorInFrame = (
  cursorCoords: {
    x: number;
    y: number;
  },
  frame: NonDeleted<ExcalidrawFrameElement>,
) => {
  const [fx1, fy1, fx2, fy2] = getElementAbsoluteCoords(frame);

  return isPointWithinBounds(
    [fx1, fy1],
    [cursorCoords.x, cursorCoords.y],
    [fx2, fy2],
  );
};
