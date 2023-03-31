import { ExcalidrawElement } from "./element/types";

enum MJ4D_CUSTOMDATA_TYPES {
  MEASURE_ELEMENT,
}

export default function _hasCustomDataProperty(
  element: ExcalidrawElement,
  property: keyof typeof MJ4D_CUSTOMDATA_TYPES,
) {
  if (element && element.customData && element.customData[property]) {
    return true;
  } else {
    return false;
  }
}
