export { newElement, newTextElement, duplicateElement } from "./newElement";
export {
  getElementAbsoluteCoords,
  getDiamondPoints,
  getArrowPoints,
  getLinePoints,
} from "./bounds";

export { handlerRectangles } from "./handlerRectangles";
export { hitTest } from "./collision";
export {
  resizeTest,
  getCursorForResizingElement,
  normalizeResizeHandle,
} from "./resizeTest";
export { isTextElement } from "./typeChecks";
export { textWysiwyg } from "./textWysiwyg";
export { redrawTextBoundingBox } from "./textElement";
export {
  getPerfectElementSize,
  isInvisiblySmallElement,
  resizePerfectLineForNWHandler,
  normalizeDimensions,
} from "./sizeHelpers";
