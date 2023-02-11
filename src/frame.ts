import { getElementAbsoluteCoords } from "./element";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";
import { getBoundTextElement } from "./element/textElement";
import { arrayToMap } from "./utils";
import { mutateElement } from "./element/mutateElement";
import { AppState } from "./types";
import { getSelectedElements } from "./scene";
import { isFrameElement } from "./element";

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

export const bindElementsToFramesAfterDuplication = (
  nextElements: ExcalidrawElement[],
  oldElements: readonly ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
) => {
  const nextElementMap = arrayToMap(nextElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;

  oldElements.forEach((element) => {
    if (element.frameId) {
      // use its frameId to get the new frameId
      const nextElementId = oldIdToDuplicatedId.get(element.id);
      const nextFrameId = oldIdToDuplicatedId.get(element.frameId);
      if (nextElementId) {
        const nextElement = nextElementMap.get(nextElementId);
        if (nextElement) {
          mutateElement(nextElement, {
            frameId: nextFrameId ?? null,
          });
        }
      }
    }
  });
};

export const getFramesCountInElements = (
  elements: readonly ExcalidrawElement[],
) => {
  return elements.filter(
    (element) => element.type === "frame" && !element.isDeleted,
  ).length;
};

export const getFrameElementsMap = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const frameElementsMap = new Map<
    ExcalidrawElement["id"],
    {
      frameSelected: boolean;
      elements: ExcalidrawElement[];
    }
  >();

  const selectedElements = arrayToMap(getSelectedElements(elements, appState));

  elements.forEach((element) => {
    if (isFrameElement(element)) {
      frameElementsMap.set(element.id, {
        frameSelected: selectedElements.has(element.id),
        elements: frameElementsMap.has(element.id)
          ? frameElementsMap.get(element.id)?.elements ??
            getElementsInFrame(elements, element.id)
          : getElementsInFrame(elements, element.id),
      });
    } else if (element.frameId) {
      frameElementsMap.set(element.frameId, {
        frameSelected: false,
        elements: frameElementsMap.has(element.frameId)
          ? frameElementsMap.get(element.id)?.elements ??
            getElementsInFrame(elements, element.frameId)
          : getElementsInFrame(elements, element.frameId),
      });
    }
  });

  return frameElementsMap;
};
