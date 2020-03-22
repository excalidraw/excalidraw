import { ExcalidrawElement, Versioned, NonDeleted } from "./types";

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

export function versionedToNonDeleted(
  elements: readonly Versioned<ExcalidrawElement>[],
): readonly NonDeleted<ExcalidrawElement>[] {
  return elements.filter(element => !element.isDeleted) as NonDeleted<
    ExcalidrawElement
  >[];
}

export function isNonDeleted(
  element: ExcalidrawElement,
): element is NonDeleted<ExcalidrawElement> {
  return !(element as Versioned<ExcalidrawElement>).isDeleted;
}

export function assertNonDeleted<TElement extends ExcalidrawElement>(
  element: TElement,
): asserts element is NonDeleted<TElement> {
  if (!isNonDeleted(element)) {
    throw new Error("Expected element not to be deleted");
  }
}
