/**
 * Create and link between shapes.
 */

import { ELEMENT_LINK_KEY } from "../constants";
import { normalizeLink } from "../data/url";
import { elementsAreInSameGroup } from "../groups";

import type { AppProps, AppState } from "../types";
import type { ExcalidrawElement } from "./types";

export const defaultGetElementLinkFromSelection: Exclude<
  AppProps["generateLinkForSelection"],
  undefined
> = (id, type) => {
  const url = window.location.href;

  try {
    const link = new URL(url);
    link.searchParams.set(ELEMENT_LINK_KEY, id);

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

export const parseElementLinkFromURL = (url: string) => {
  try {
    const { searchParams } = new URL(url);
    if (searchParams.has(ELEMENT_LINK_KEY)) {
      const id = searchParams.get(ELEMENT_LINK_KEY);
      return id;
    }
  } catch {}

  return null;
};
