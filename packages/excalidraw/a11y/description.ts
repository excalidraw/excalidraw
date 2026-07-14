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
import {
  getContainedElementsCount,
  getGeometricContainer,
} from "./containment";
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

/**
 * Elements connected to this one through bound arrows (the shape-side view
 * of the connection graph); for arrows, their two bound endpoints. Ordered
 * by `boundElements` / start-to-end, deduplicated, deleted targets skipped.
 */
export const getConnectedElements = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): ExcalidrawElement[] => {
  const connected: ExcalidrawElement[] = [];
  const seen = new Set<string>();
  const add = (elementId: string | undefined) => {
    if (!elementId || elementId === element.id || seen.has(elementId)) {
      return;
    }
    const target = elementsMap.get(elementId);
    if (target && !target.isDeleted) {
      seen.add(elementId);
      connected.push(target);
    }
  };

  if (isArrowElement(element)) {
    add(element.startBinding?.elementId);
    add(element.endBinding?.elementId);
    return connected;
  }

  for (const bound of element.boundElements ?? []) {
    if (bound.type !== "arrow") {
      continue;
    }
    const arrow = elementsMap.get(bound.id);
    if (!arrow || arrow.isDeleted || !isArrowElement(arrow)) {
      continue;
    }
    add(
      arrow.startBinding?.elementId === element.id
        ? arrow.endBinding?.elementId
        : arrow.startBinding?.elementId,
    );
  }
  return connected;
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
    const connectedNames = getConnectedElements(element, elementsMap)
      .map((target) => getEndpointName(target.id, elementsMap))
      .filter((name): name is string => !!name);
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

  // geometric nesting ("layers"): boards often express structure by
  // placing boxes inside larger labeled boxes rather than frames/arrows
  const containedCount = getContainedElementsCount(element, elementsMap);
  if (containedCount === 1) {
    parts.push(t("a11y.containsOneElement"));
  } else if (containedCount > 1) {
    parts.push(t("a11y.containsElements", { count: containedCount }));
  }

  const frame = getContainingFrame(element, elementsMap);
  if (frame) {
    parts.push(t("a11y.inFrame", { name: getFrameLikeTitle(frame) }));
  }
  const container = getGeometricContainer(element, elementsMap);
  if (container) {
    const containerText = getElementText(container, elementsMap);
    if (containerText) {
      parts.push(t("a11y.insideContainer", { name: truncate(containerText) }));
    }
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
