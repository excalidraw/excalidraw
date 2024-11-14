/**
 * Create and link between shapes.
 */

import { normalizeLink } from "../data/url";
import { elementsAreInSameGroup, getElementsInGroup } from "../groups";
import type { AppState } from "../types";
import type { ElementsMap, ExcalidrawElement } from "./types";

export const createShapeLink = (
  selectedElements: ExcalidrawElement[],
  prefix: string,
  appState: AppState,
) => {
  if (canCreateShapeLinkFromElements(selectedElements)) {
    if (selectedElements.length === 1) {
      return normalizeLink(`${prefix}/?element=${selectedElements[0].id}`);
    }

    if (selectedElements.length > 1) {
      const selectedGroupId = Object.keys(appState.selectedGroupIds)[0];

      if (selectedGroupId) {
        return normalizeLink(`${prefix}/?group=${selectedGroupId}`);
      }

      return normalizeLink(
        `${prefix}/?group=${selectedElements[0].groupIds[0]}`,
      );
    }
  }

  return null;
};

export const getElementsFromQuery = (
  query: string,
  elementsMap: ElementsMap,
): {
  elements: ExcalidrawElement[] | null;
  isShapeLink: boolean;
} => {
  const searchParams = new URLSearchParams(query);

  if (searchParams.has("element")) {
    const id = searchParams.get("element");
    if (id) {
      const el = elementsMap.get(id);
      if (el) {
        return {
          elements: el ? [el] : null,
          isShapeLink: true,
        };
      }
    }
  }

  if (searchParams.has("group")) {
    const id = searchParams.get("group");
    if (id) {
      const elementsInGroup = getElementsInGroup(elementsMap, id);

      return {
        elements: elementsInGroup,
        isShapeLink: true,
      };
    }
  }

  return {
    elements: null,
    isShapeLink: false,
  };
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
