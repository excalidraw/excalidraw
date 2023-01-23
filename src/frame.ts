import { getElementAbsoluteCoords } from "./element";
import { mutateElement } from "./element/mutateElement";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";
import { getBoundTextElement } from "./element/textElement";

export const getElementsInFrame = (
  elements: readonly ExcalidrawElement[],
  frameId: string,
) => elements.filter((element) => element.frameId === frameId);

// TODO: include rotation when rotation is enabled
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

export const getElementsToUpdateForFrame = (
  selectedElements: NonDeletedExcalidrawElement[],
  predicate: (element: NonDeletedExcalidrawElement) => boolean,
): NonDeletedExcalidrawElement[] => {
  const elementsToUpdate: NonDeletedExcalidrawElement[] = [];

  selectedElements.forEach((element) => {
    if (predicate(element)) {
      elementsToUpdate.push(element);
      // since adding elements to a frame will alter the z-indexes
      // we have to add bound text element to the update array as well
      // to keep the text right next to its container
      const textElement = getBoundTextElement(element);
      if (textElement) {
        elementsToUpdate.push(textElement);
      }
    }
  });

  return elementsToUpdate;
};
