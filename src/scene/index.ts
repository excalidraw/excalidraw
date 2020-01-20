export { isOverScrollBars } from "./scrollbars";
export {
  clearSelection,
  getSelectedIndices,
  deleteSelectedElements,
  someElementIsSelected,
  getElementsWithinSelection,
  getSelectedAttribute
} from "./selection";
export {
  exportCanvas,
  loadFromJSON,
  saveAsJSON,
  restoreFromLocalStorage,
  saveToLocalStorage,
  exportToBackend,
  importFromBackend
} from "./data";
export {
  hasBackground,
  hasStroke,
  getElementAtPosition,
  getElementContainingPosition,
  hasText
} from "./comparisons";
export { createScene } from "./createScene";
