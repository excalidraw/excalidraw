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
