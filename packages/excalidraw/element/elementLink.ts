/**
 * Create and link between shapes.
 */

import { ELEMENT_LINK_KEY } from "../constants";
import { normalizeLink } from "../data/url";
import { elementsAreInSameGroup, getElementsInGroup } from "../groups";
import type { AppProps, AppState } from "../types";
import type { ElementsMap, ExcalidrawElement } from "./types";

export const defaultGetElementLinkFromSelection: Exclude<
  AppProps["generateLinkForSelection"],
  undefined
> = (id, type) => {
  const url = window.location.href;

  try {
    const link = new URL(url);
    link.searchParams.set("elementLink", id);

    return normalizeLink(link.toString());
  } catch (error) {
    console.error(error);
  }

  return normalizeLink(url);
};

export const getLinkIdAndTypeFromSelection = (
  selectedElements: ExcalidrawElement[],
  appState: AppState,
): {
  id: string;
  type: "element" | "group";
} | null => {
  if (
    selectedElements.length > 0 &&
    canCreateLinkFromElements(selectedElements)
  ) {
    if (selectedElements.length === 1) {
      return {
        id: selectedElements[0].id,
        type: "element",
      };
    }

    if (selectedElements.length > 1) {
      const selectedGroupId = Object.keys(appState.selectedGroupIds)[0];

      if (selectedGroupId) {
        return {
          id: selectedGroupId,
          type: "group",
        };
      }
      return {
        id: selectedElements[0].groupIds[0],
        type: "group",
      };
    }
  }

  return null;
};

export const getElementsFromQuery = (
  query: string,
  elementsMap: ElementsMap,
): {
  elements: ExcalidrawElement[] | null;
  isElementLink: boolean;
} => {
  const searchParams = new URLSearchParams(query);

  if (searchParams.has(ELEMENT_LINK_KEY)) {
    const id = searchParams.get(ELEMENT_LINK_KEY);
    if (id) {
      // first check if the id is an element
      const el = elementsMap.get(id);
      if (el) {
        return {
          elements: el ? [el] : null,
          isElementLink: true,
        };
      }

      // then, check if the id is a group
      const elementsInGroup = getElementsInGroup(elementsMap, id);

      if (elementsInGroup.length > 0) {
        return {
          elements: elementsInGroup,
          isElementLink: true,
        };
      }
    }
  }

  return {
    elements: null,
    isElementLink: false,
  };
};

export const canCreateLinkFromElements = (
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

export const isElementLink = (url: string) => {
  try {
    const _url = new URL(url);
    return (
      _url.searchParams.has(ELEMENT_LINK_KEY) &&
      _url.host === window.location.host
    );
  } catch (error) {
    return false;
  }
};
