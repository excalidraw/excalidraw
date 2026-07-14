import {
  getBoundTextElement,
  getContainingFrame,
  getFrameLikeTitle,
  isArrowElement,
  isFrameLikeElement,
  isImageElement,
  isTextElement,
} from "@excalidraw/element";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import { getElementColorDescription } from "./colorName";
import { getImageAltText } from "./ImageAltTextDialog";

import type { TranslationKeys } from "../i18n";

const TEXT_PREVIEW_LENGTH = 60;

const truncate = (text: string) => {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > TEXT_PREVIEW_LENGTH
    ? `${singleLine.slice(0, TEXT_PREVIEW_LENGTH - 1)}…`
    : singleLine;
};

export const getElementTypeLabel = (element: ExcalidrawElement) =>
  t(`a11y.elementType.${element.type}` as TranslationKeys, null, element.type);

/** the element's own human text: its text content, bound label, or frame name */
export const getElementText = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): string | null => {
  if (isTextElement(element)) {
    return element.text || null;
  }
  if (isFrameLikeElement(element)) {
    return getFrameLikeTitle(element);
  }
  if (isImageElement(element)) {
    return getImageAltText(element);
  }
  return getBoundTextElement(element, elementsMap)?.text || null;
};

const getEndpointName = (
  elementId: string | undefined,
  elementsMap: ElementsMap,
): string | null => {
  const target = elementId ? elementsMap.get(elementId) : null;
  if (!target || target.isDeleted) {
    return null;
  }
  const text = getElementText(target, elementsMap);
  return text ? truncate(text) : getElementTypeLabel(target);
};

export type ElementDescriptionOptions = {
  /** 1-based position in reading order */
  position?: number;
  total?: number;
  selected?: boolean;
};

/**
 * Human-readable description of an element for screen readers, e.g.
 * `"Start", rectangle, 3 of 12, in frame "Login flow"` or
 * `Arrow from "Start" to "Validate input", 4 of 12`.
 */
export const getElementDescription = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  { position, total, selected }: ElementDescriptionOptions = {},
): string => {
  const parts: string[] = [];
  const text = getElementText(element, elementsMap);

  if (isArrowElement(element) && (element.startBinding || element.endBinding)) {
    if (text) {
      parts.push(`"${truncate(text)}"`);
    }
    const from = getEndpointName(element.startBinding?.elementId, elementsMap);
    const to = getEndpointName(element.endBinding?.elementId, elementsMap);
    if (from && to) {
      parts.push(t("a11y.arrowConnecting", { from, to }));
    } else if (from) {
      parts.push(t("a11y.arrowFrom", { from }));
    } else if (to) {
      parts.push(t("a11y.arrowTo", { to }));
    }
  } else {
    if (text) {
      parts.push(`"${truncate(text)}"`);
    }
    parts.push(getElementTypeLabel(element));
  }

  // conceptual color ("red", "blue, light green fill") — lets non-visual
  // users tell that elements sharing a color belong together
  const color = getElementColorDescription(element);
  if (color) {
    parts.push(color);
  }

  if (position && total) {
    parts.push(t("a11y.positionInScene", { position, total }));
  }

  // what this shape is connected to, derived from its bound arrows —
  // gives the shape-side view of the connection graph
  if (!isArrowElement(element) && element.boundElements?.length) {
    const connectedNames: string[] = [];
    for (const bound of element.boundElements) {
      if (bound.type !== "arrow") {
        continue;
      }
      const arrow = elementsMap.get(bound.id);
      if (!arrow || arrow.isDeleted || !isArrowElement(arrow)) {
        continue;
      }
      const otherId =
        arrow.startBinding?.elementId === element.id
          ? arrow.endBinding?.elementId
          : arrow.startBinding?.elementId;
      if (!otherId || otherId === element.id) {
        continue;
      }
      const name = getEndpointName(otherId, elementsMap);
      if (name) {
        connectedNames.push(name);
      }
    }
    if (connectedNames.length) {
      const MAX_NAMED_CONNECTIONS = 3;
      const named = connectedNames.slice(0, MAX_NAMED_CONNECTIONS).join(", ");
      const surplus = connectedNames.length - MAX_NAMED_CONNECTIONS;
      parts.push(
        t("a11y.connectedTo", {
          names: surplus > 0 ? `${named} +${surplus}` : named,
        }),
      );
    }
  }

  const frame = getContainingFrame(element, elementsMap);
  if (frame) {
    parts.push(t("a11y.inFrame", { name: getFrameLikeTitle(frame) }));
  }
  if (element.groupIds.length > 0) {
    parts.push(t("a11y.inGroup"));
  }
  if (selected) {
    parts.push(t("a11y.selected"));
  }
  if (element.locked) {
    parts.push(t("a11y.locked"));
  }
  if (element.link) {
    parts.push(t("a11y.hasLink"));
  }

  return parts.join(", ");
};
