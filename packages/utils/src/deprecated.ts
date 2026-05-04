import { arrayToMap, type Bounds } from "@excalidraw/common";
import {
  boundsContainBounds,
  doBoundsIntersect,
  getElementBounds,
} from "@excalidraw/element";
import { isExcalidrawElement } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

/**
 * High level helper to get elements overlapping a bounding box.
 * It can be used to get elements overlapping a selection box, for example.
 *
 * @deprecated Use doBoundsIntersect or boundsContainBounds directly.
 */
export const elementsOverlappingBBox = ({
  elements,
  elementsMap,
  bounds,
  type,
  errorMargin = 0,
}: {
  elements: NonDeletedExcalidrawElement[];
  elementsMap?: ElementsMap;
  bounds: Bounds | ExcalidrawElement;
  errorMargin?: number;
  /**
   * - overlap: elements overlapping or inside bounds
   * - contain: elements inside bounds or bounds inside elements
   * - inside: elements inside bounds
   **/
  type: "overlap" | "contain" | "inside";
}) => {
  if (!elementsMap) {
    elementsMap = arrayToMap(elements);
  }

  if (isExcalidrawElement(bounds)) {
    bounds = getElementBounds(bounds, elementsMap);
  }

  const adjustedBBox: Bounds = [
    bounds[0] - errorMargin,
    bounds[1] - errorMargin,
    bounds[2] + errorMargin,
    bounds[3] + errorMargin,
  ];

  const includedElements = new Set<ExcalidrawElement>();
  for (const element of elements) {
    const elementBounds = getElementBounds(element, elementsMap);

    switch (type) {
      case "overlap":
        if (doBoundsIntersect(elementBounds, adjustedBBox)) {
          includedElements.add(element);
        }
        break;
      case "contain":
        if (
          boundsContainBounds(adjustedBBox, elementBounds) ||
          boundsContainBounds(elementBounds, adjustedBBox)
        ) {
          includedElements.add(element);
        }
        break;
      case "inside":
        if (boundsContainBounds(adjustedBBox, elementBounds)) {
          includedElements.add(element);
        }
        break;
    }
  }

  return Array.from(includedElements);
};
