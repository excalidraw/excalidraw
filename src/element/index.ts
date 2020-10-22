import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
} from "./types";
import { isInvisiblySmallElement } from "./sizeHelpers";

export {
  newElement,
  newTextElement,
  updateTextElement,
  newLinearElement,
  duplicateElement,
} from "./newElement";
export {
  getElementAbsoluteCoords,
  getElementBounds,
  getCommonBounds,
  getDiamondPoints,
  getArrowPoints,
  getClosestElementBounds,
} from "./bounds";

export {
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  getTransformHandlesFromCoords,
  getTransformHandles,
} from "./transformHandles";
export {
  hitTest,
  isHittingElementBoundingBoxWithoutHittingElement,
} from "./collision";
export {
  resizeTest,
  getCursorForResizingElement,
  normalizeTransformHandleType,
  getElementWithTransformHandleType,
  getTransformHandleTypeFromCoords,
} from "./resizeTest";
export {
  transformElements,
  getResizeOffsetXY,
  getResizeArrowDirection,
} from "./resizeElements";
export {
  dragSelectedElements,
  getDragOffsetXY,
  dragNewElement,
} from "./dragElements";
export { isTextElement, isExcalidrawElement } from "./typeChecks";
export { textWysiwyg } from "./textWysiwyg";
export { redrawTextBoundingBox } from "./textElement";
export {
  getPerfectElementSize,
  isInvisiblySmallElement,
  resizePerfectLineForNWHandler,
  getNormalizedDimensions,
} from "./sizeHelpers";
export { showSelectedShapeActions } from "./showSelectedShapeActions";

export const getSyncableElements = (
  elements: readonly ExcalidrawElement[], // There are places in Excalidraw where synthetic invisibly small elements are added and removed.
) =>
  // It's probably best to keep those local otherwise there might be a race condition that
  // gets the app into an invalid state. I've never seen it happen but I'm worried about it :)
  elements.filter((el) => el.isDeleted || !isInvisiblySmallElement(el));

export const getElementMap = (elements: readonly ExcalidrawElement[]) =>
  elements.reduce(
    (acc: { [key: string]: ExcalidrawElement }, element: ExcalidrawElement) => {
      acc[element.id] = element;
      return acc;
    },
    {},
  );

export const getSceneVersion = (elements: readonly ExcalidrawElement[]) =>
  elements.reduce((acc, el) => acc + el.version, 0);

export const getNonDeletedElements = (elements: readonly ExcalidrawElement[]) =>
  elements.filter(
    (element) => !element.isDeleted,
  ) as readonly NonDeletedExcalidrawElement[];

export const isNonDeletedElement = <T extends ExcalidrawElement>(
  element: T,
): element is NonDeleted<T> => !element.isDeleted;

export const getElementsAfterReconcilation = (
  currentElements: readonly ExcalidrawElement[],
  sceneElements: readonly ExcalidrawElement[],
  elementState: {
    editingElement: NonDeletedExcalidrawElement | null;
    resizingElement: NonDeletedExcalidrawElement | null;
    draggingElement: NonDeletedExcalidrawElement | null;
  },
) => {
  // create a map of ids so we don't have to iterate
  // over the array more than once.
  const localElementMap = getElementMap(currentElements);

  // Reconcile
  const newElements = sceneElements
    .reduce((elements, element) => {
      // if the remote element references one that's currently
      //  edited on local, skip it (it'll be added in the next
      //  step)
      if (
        element.id === elementState.editingElement?.id ||
        element.id === elementState.resizingElement?.id ||
        element.id === elementState.draggingElement?.id
      ) {
        return elements;
      }

      if (
        localElementMap.hasOwnProperty(element.id) &&
        localElementMap[element.id].version > element.version
      ) {
        elements.push(localElementMap[element.id]);
        delete localElementMap[element.id];
      } else if (
        localElementMap.hasOwnProperty(element.id) &&
        localElementMap[element.id].version === element.version &&
        localElementMap[element.id].versionNonce !== element.versionNonce
      ) {
        // resolve conflicting edits deterministically by taking the one with the lowest versionNonce
        if (localElementMap[element.id].versionNonce < element.versionNonce) {
          elements.push(localElementMap[element.id]);
        } else {
          // it should be highly unlikely that the two versionNonces are the same. if we are
          // really worried about this, we can replace the versionNonce with the socket id.
          elements.push(element);
        }
        delete localElementMap[element.id];
      } else {
        elements.push(element);
        delete localElementMap[element.id];
      }

      return elements;
    }, [] as Mutable<typeof sceneElements>)
    // add local elements that weren't deleted or on remote
    .concat(...Object.values(localElementMap));
  return newElements;
};
