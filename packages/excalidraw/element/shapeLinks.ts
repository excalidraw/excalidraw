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
  isAShapeLink: boolean;
} => {
  const searchParams = new URLSearchParams(query);

  if (searchParams.has("element")) {
    const id = searchParams.get("element");
    if (id) {
      const el = elementsMap.get(id);
      if (el) {
        return {
          elements: el ? [el] : null,
          isAShapeLink: true,
        };
      }

      return {
        elements: null,
        isAShapeLink: true,
      };
    }
  }

  if (searchParams.has("group")) {
    const id = searchParams.get("group");
    if (id) {
      const elementsInGroup = getElementsInGroup(elementsMap, id);

      return {
        elements: elementsInGroup,
        isAShapeLink: true,
      };
    }
  }

  return {
    elements: null,
    isAShapeLink: false,
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

export const isShapeLink = (url: string) => {
  try {
    const _url = new URL(url);
    const query = _url.search;
    const searchParams = new URLSearchParams(query);
    return (
      (searchParams.has("element") || searchParams.has("group")) &&
      _url.host === window.location.host
    );
  } catch (error) {
    return false;
  }
};
