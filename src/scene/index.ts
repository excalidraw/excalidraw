export { isOverScrollBars } from "./scrollbars";
export { renderScene } from "./render";
export {
  clearSelection,
  getSelectedIndices,
  deleteSelectedElements,
  someElementIsSelected,
  setSelection,
  getSelectedAttribute
} from "./selection";
export {
  exportAsPNG,
  loadFromJSON,
  saveAsJSON,
  restoreFromLocalStorage,
  saveToLocalStorage,
  restoreFromURL,
  saveToURL
} from "./data";
export { hasBackground, hasStroke, getElementAtPosition } from "./comparisons";
export { createScene } from "./createScene";
