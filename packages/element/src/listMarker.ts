import { arrayToMap } from "@excalidraw/common";

import { refreshTextDimensions } from "./newElement";
import {
  getBoundTextElement,
  getContainerElement,
  redrawTextBoundingBox,
} from "./textElement";
import { isBoundToContainer, isTextElement } from "./typeChecks";

import type { Scene } from "./Scene";
import type { ExcalidrawElement, ExcalidrawTextElement } from "./types";

/**
 * A list marker a text starts with: `1.`, `1)`, `(1)`, `[1]`, `a.`, `a)`,
 * `(a)`, `A.`, `iv.` etc. Must be followed by whitespace (or nothing), so that
 * `1.5` or `e.g.` aren't list markers. See also `LONE_NUMBER_REGEX`.
 *
 * (Letters don't take `[]`, as `[a]` tends to mean other things.)
 */
const LIST_MARKER_REGEX =
  /^(\s*)(?:\((\d{1,9}|[a-zA-Z]+)\)|\[(\d{1,9})\]|(\d{1,9}|[a-zA-Z]+)([.)]))(?=\s|$)/;

/** a text that's just a number counts as a list item too (e.g. a step badge) */
const LONE_NUMBER_REGEX = /^(\s*)(\d{1,9})\s*$/;

/** letters below `i` count alphabetically, from `i` up as roman numerals */
const LAST_ALPHA_ORDINAL = "h".charCodeAt(0) - "a".charCodeAt(0) + 1;

type ListMarkerKind = "decimal" | "alpha" | "roman";

/**
 * Lists count up to 42 (so that e.g. `2024. foo` isn't a list item), roman
 * numerals up to `xcix`.
 */
const MAX_ORDINAL: Record<ListMarkerKind, number> = {
  decimal: 42,
  alpha: 9, // i. (then switching to roman)
  roman: 99,
};

const toRoman = (value: number) =>
  ["", "x", "xx", "xxx", "xl", "l", "lx", "lxx", "lxxx", "xc"][
    Math.floor(value / 10)
  ] + ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"][value % 10];

const ROMAN_VALUES = new Map(
  Array.from({ length: MAX_ORDINAL.roman }, (_, index) => [
    toRoman(index + 1),
    index + 1,
  ]),
);

type ListMarker = {
  /** where the marker's value starts in the text */
  index: number;
  value: string;
  kind: ListMarkerKind;
  isUpperCase: boolean;
  /** e.g. `1.` and `2.` are of the same style, but `1.` and `(1)` aren't */
  style: string;
  /** 1-based */
  ordinal: number;
  /** where the item's text (after the marker and whitespace) starts */
  contentIndex: number;
};

const parseLoneNumber = (text: string): ListMarker | null => {
  const match = text.match(LONE_NUMBER_REGEX);
  if (!match) {
    return null;
  }

  const [, indent, value] = match;

  return {
    index: indent.length,
    value,
    kind: "decimal",
    isUpperCase: false,
    style: "decimal",
    ordinal: parseInt(value, 10),
    contentIndex: text.length,
  };
};

const parseListMarker = (text: string): ListMarker | null => {
  const match = text.match(LIST_MARKER_REGEX);
  if (!match) {
    return null;
  }

  const [, indent, parenValue, bracketValue, plainValue, plainSuffix] = match;
  const value = parenValue ?? bracketValue ?? plainValue;
  const lowerCaseValue = value.toLowerCase();
  const isUpperCase = /[A-Z]/.test(value);
  const alphaOrdinal = lowerCaseValue.charCodeAt(0) - "a".charCodeAt(0) + 1;

  let kind: ListMarkerKind;
  let ordinal: number;

  if (/\d/.test(value)) {
    kind = "decimal";
    ordinal = parseInt(value, 10);
  } else if (isUpperCase && /[a-z]/.test(value)) {
    // mixed case
    return null;
  } else if (value.length === 1 && alphaOrdinal <= LAST_ALPHA_ORDINAL) {
    kind = "alpha";
    ordinal = alphaOrdinal;
  } else if (ROMAN_VALUES.has(lowerCaseValue)) {
    kind = "roman";
    ordinal = ROMAN_VALUES.get(lowerCaseValue)!;
  } else {
    return null;
  }

  const affixes =
    parenValue !== undefined
      ? "()"
      : bracketValue !== undefined
      ? "[]"
      : plainSuffix;

  return {
    index: indent.length + (plainValue !== undefined ? 0 : 1),
    value,
    kind,
    isUpperCase,
    style: `${kind}${isUpperCase ? "-upper" : ""}${affixes}`,
    ordinal,
    contentIndex:
      match[0].length + text.slice(match[0].length).match(/^\s*/)![0].length,
  };
};

/**
 * @returns the list marker the text starts with (or the number the text is),
 *          unless the text is a whole list (other lines start with markers of
 *          the same style)
 */
const getListItemMarker = (text: string): ListMarker | null => {
  const marker = parseLoneNumber(text) ?? parseListMarker(text);
  if (!marker || marker.ordinal > MAX_ORDINAL[marker.kind]) {
    return null;
  }

  const otherLines = text.slice(marker.index).split("\n").slice(1);
  if (
    otherLines.some((line) => parseListMarker(line)?.style === marker.style)
  ) {
    return null;
  }

  return marker;
};

/** @returns `null` if the marker would be past `MAX_ORDINAL` */
const renumberListMarker = (
  text: string,
  marker: ListMarker,
  ordinal: number,
): string | null => {
  if (ordinal > MAX_ORDINAL[marker.kind]) {
    return null;
  }

  let value: string;
  if (marker.kind === "decimal") {
    // keep zero padding (`01.` -> `02.`)
    value = String(ordinal).padStart(
      marker.value.startsWith("0") ? marker.value.length : 0,
      "0",
    );
  } else if (marker.kind === "alpha") {
    value = String.fromCharCode("a".charCodeAt(0) + ordinal - 1);
  } else {
    value = toRoman(ordinal);
  }

  if (marker.isUpperCase) {
    value = value.toUpperCase();
  }

  return (
    text.slice(0, marker.index) +
    value +
    text.slice(marker.index + marker.value.length)
  );
};

/** a list marker advanced by duplication, to go back and forth */
export type ListMarkerAdvance = {
  elementId: ExcalidrawTextElement["id"];
  prevOriginalText: string;
  nextOriginalText: string;
  /**
   * where the item's text (after the marker and whitespace) starts in
   * `nextOriginalText` (its length if there's none)
   */
  contentStart: number;
  /** the label's container before the label (may have) grown it */
  prevContainerSize: { width: number; height: number } | null;
};

const setText = (
  element: ExcalidrawTextElement,
  container: ExcalidrawElement | null,
  originalText: string,
  scene: Scene,
) => {
  if (container) {
    scene.mutateElement(element, { originalText });
    // re-wraps the label, and grows the container if need be
    redrawTextBoundingBox(element, container, scene);
  } else {
    scene.mutateElement(element, {
      originalText,
      // re-wraps the text, and keeps it anchored as per its alignment
      ...refreshTextDimensions(
        element,
        null,
        scene.getNonDeletedElementsMap(),
        originalText,
      ),
    });
  }
};

/**
 * Advances the list markers of the duplicated texts and labels, so that
 * duplicating `1. foo` gives `2. foo` (and `1` gives `2`).
 *
 * Duplicating several list items at once continues the list from the
 * highest of them: duplicating `1.`, `3.`, `5.` gives `6.`, `7.`, `8.` (only
 * if they're just markers, i.e. without text).
 *
 * Only if nothing but list items (texts, or containers with list item labels)
 * is duplicated.
 */
export const advanceDuplicatedListMarkers = (
  duplicatedElements: readonly ExcalidrawElement[],
  scene: Scene,
): ListMarkerAdvance[] => {
  const duplicatesMap = arrayToMap(duplicatedElements);
  const elementsMap = scene.getNonDeletedElementsMap();

  // per marker style
  const itemsByStyle = new Map<
    string,
    {
      element: ExcalidrawTextElement;
      container: ExcalidrawElement | null;
      marker: ListMarker;
    }[]
  >();

  for (const element of duplicatedElements) {
    // a label goes with its container
    if (isBoundToContainer(element) && duplicatesMap.has(element.containerId)) {
      continue;
    }

    const text = isTextElement(element)
      ? element
      : getBoundTextElement(element, elementsMap);
    const marker = text && getListItemMarker(text.originalText);
    // list items duplicated along with anything else (another text, a shape,
    // a frame they're in…) are copied as they are
    if (!text || !marker) {
      return [];
    }

    const items = itemsByStyle.get(marker.style) ?? [];
    items.push({
      element: text,
      container: text === element ? null : element,
      marker,
    });
    itemsByStyle.set(marker.style, items);
  }

  // several list items are continued only if they're just markers (`1.`,
  // `2.`, `3.`), not items with text (`1. foo`, `2. bar`)
  const allItems = [...itemsByStyle.values()].flat();
  if (
    allItems.length > 1 &&
    allItems.some(
      ({ element, marker }) =>
        marker.contentIndex < element.originalText.length,
    )
  ) {
    return [];
  }

  const advances: ListMarkerAdvance[] = [];

  for (const items of itemsByStyle.values()) {
    const maxOrdinal = Math.max(...items.map((item) => item.marker.ordinal));
    // (stable, so items with the same marker keep their order)
    items.sort((a, b) => a.marker.ordinal - b.marker.ordinal);

    for (const [index, { element, container, marker }] of items.entries()) {
      const nextOriginalText = renumberListMarker(
        element.originalText,
        marker,
        maxOrdinal + 1 + index,
      );
      if (nextOriginalText === null) {
        continue;
      }

      advances.push({
        elementId: element.id,
        prevOriginalText: element.originalText,
        nextOriginalText,
        contentStart:
          marker.contentIndex +
          nextOriginalText.length -
          element.originalText.length,
        prevContainerSize: container
          ? { width: container.width, height: container.height }
          : null,
      });

      setText(element, container, nextOriginalText, scene);
    }
  }

  return advances;
};

/**
 * Sets the advanced list markers back (`"prev"`), or forth again (`"next"`).
 */
export const applyListMarkerAdvances = (
  advances: readonly ListMarkerAdvance[],
  direction: "prev" | "next",
  scene: Scene,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();

  for (const advance of advances) {
    const element = elementsMap.get(advance.elementId);
    if (!element || !isTextElement(element)) {
      continue;
    }

    const container = getContainerElement(element, elementsMap);
    if (direction === "prev" && container && advance.prevContainerSize) {
      // labels only ever grow their containers
      scene.mutateElement(container, advance.prevContainerSize);
    }

    setText(
      element,
      container,
      direction === "prev"
        ? advance.prevOriginalText
        : advance.nextOriginalText,
      scene,
    );
  }
};
