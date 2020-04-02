import { ExcalidrawElement } from "./types";
import { isInvisiblySmallElement } from "./sizeHelpers";

export {
  newElement,
  newTextElement,
  newLinearElement,
  duplicateElement,
} from "./newElement";
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
  // There are places in Excalidraw where synthetic invisibly small elements are added and removed.
  // It's probably best to keep those local otherwise there might be a race condition that
  // gets the app into an invalid state. I've never seen it happen but I'm worried about it :)
  return elements.filter((el) => el.isDeleted || !isInvisiblySmallElement(el));
}

export function getElementMap(elements: readonly ExcalidrawElement[]) {
  return elements.reduce(
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

export function hasNonDeletedElements(elements: readonly ExcalidrawElement[]) {
  return elements.some((element) => !element.isDeleted);
}
