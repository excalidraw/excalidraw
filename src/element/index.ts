import { ExcalidrawElement } from "./types";
import { isInvisiblySmallElement } from "./sizeHelpers";

export { newElement, newTextElement, duplicateElement } from "./newElement";
export {
  getElementAbsoluteCoords,
  getCommonBounds,
  getDiamondPoints,
  getArrowPoints,
  getLinearElementAbsoluteBounds,
} from "./bounds";

export { handlerRectangles } from "./handlerRectangles";
export { hitTest } from "./collision";
export {
  resizeTest,
  getCursorForResizingElement,
  normalizeResizeHandle,
} from "./resizeTest";
export { isTextElement, isExcalidrawElement } from "./typeChecks";
export { textWysiwyg } from "./textWysiwyg";
export { redrawTextBoundingBox } from "./textElement";
export {
  getPerfectElementSize,
  isInvisiblySmallElement,
  resizePerfectLineForNWHandler,
  normalizeDimensions,
} from "./sizeHelpers";
export { showSelectedShapeActions } from "./showSelectedShapeActions";

export function getSyncableElements(elements: readonly ExcalidrawElement[]) {
  return elements.filter(el => !isInvisiblySmallElement(el));
}

export function getElementMap(elements: readonly ExcalidrawElement[]) {
  return getSyncableElements(elements).reduce(
    (acc: { [key: string]: ExcalidrawElement }, element: ExcalidrawElement) => {
      acc[element.id] = element;
      return acc;
    },
    {},
  );
}

export function getDrawingVersion(elements: readonly ExcalidrawElement[]) {
  return elements.reduce((acc, el) => acc + el.version, 0);
}

export function countNonDeletedElements(
  elements: readonly ExcalidrawElement[],
) {
  return elements.filter(element => !element.isDeleted).length;
}
