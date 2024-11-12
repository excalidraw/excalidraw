/**
 * Create and link between shapes.
 */

import { normalizeLink } from "../data/url";
import { elementsAreInSameGroup, getElementsInGroup } from "../groups";
import type { ElementsMap, ExcalidrawElement } from "./types";

export const createShapeLink = (
  selectedElements: ExcalidrawElement[],
  prefix: string,
) => {
  if (canCreateShapeLinkFromElements(selectedElements)) {
    if (selectedElements.length === 1) {
      return normalizeLink(`${prefix}/?element=${selectedElements[0].id}`);
    }

    return normalizeLink(`${prefix}/?group=${selectedElements[0].groupIds[0]}`);
  }

  return null;
};

export const getElementsFromQuery = (
  query: string,
  elementsMap: ElementsMap,
) => {
  const searchParams = new URLSearchParams(query);

  if (searchParams.has("element")) {
    const id = searchParams.get("element");
    if (id) {
      const el = elementsMap.get(id);
      if (el) {
        return [el];
      }
      return null;
    }
  }

  if (searchParams.has("group")) {
    const id = searchParams.get("group");
    if (id) {
      const elementsInGroup = getElementsInGroup(elementsMap, id);
      return elementsInGroup;
    }
  }

  return null;
};

export const canCreateShapeLinkFromElements = (
  selectedElements: ExcalidrawElement[],
) => {
  if (selectedElements.length === 1) {
    return true;
  }

  if (selectedElements.length > 1 && elementsAreInSameGroup(selectedElements)) {
    return true;
  }

  return false;
};
