import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./element/types";

enum MJ4D_CUSTOMDATA_TYPES {
  MEASURE_ELEMENT,
  BINDING_DOT_WIDTH,
}

export function _hasCustomDataProperty(
  element: ExcalidrawElement,
  property: keyof typeof MJ4D_CUSTOMDATA_TYPES,
) {
  if (element && element.customData && element.customData[property]) {
    return true;
  }
  return false;
}

export function _isMeasureIncludedInSelection(
  elements: NonDeletedExcalidrawElement[],
) {
  return elements.some((el) => _hasCustomDataProperty(el, "MEASURE_ELEMENT"));
}
