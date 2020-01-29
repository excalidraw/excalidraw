export { isOverScrollBars } from "./scrollbars";
export {
  clearSelection,
  getSelectedIndices,
  deleteSelectedElements,
  someElementIsSelected,
  getElementsWithinSelection,
  getCommonAttributeOfSelectedElements,
} from "./selection";
export {
  exportCanvas,
  loadFromJSON,
  saveAsJSON,
  restoreFromLocalStorage,
  saveToLocalStorage,
  exportToBackend,
  importFromBackend,
  addToLoadedScenes,
  loadedScenes,
} from "./data";
export {
  hasBackground,
  hasStroke,
  getElementAtPosition,
  getElementContainingPosition,
  hasText,
} from "./comparisons";
export { createScene } from "./createScene";
