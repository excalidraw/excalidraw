import { ExcalidrawElement, Versioned } from "./types";

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

export function getElementMap<TElement extends ExcalidrawElement>(
  elements: readonly TElement[],
) {
  return elements.reduce(
    (acc: { [key: string]: TElement }, element: TElement) => {
      acc[element.id] = element;
      return acc;
    },
    {},
  );
}

export function getDrawingVersion(
  elements: readonly Versioned<ExcalidrawElement>[],
) {
  return elements.reduce((acc, el) => acc + el.version, 0);
}
