import { toIterable } from "@excalidraw/common";

import { isInvisiblySmallElement } from "./sizeHelpers";
import { isLinearElementType } from "./typeChecks";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  ElementsMapOrArray,
} from "./types";

/**
 * @deprecated unsafe, use hashElementsVersion instead
 */
export const getSceneVersion = (elements: readonly ExcalidrawElement[]) =>
  elements.reduce((acc, el) => acc + el.version, 0);

/**
 * Hashes elements' versionNonce (using djb2 algo). Order of elements matters.
 */
export const hashElementsVersion = (elements: ElementsMapOrArray): number => {
  let hash = 5381;
  for (const element of toIterable(elements)) {
    hash = (hash << 5) + hash + element.versionNonce;
  }
  return hash >>> 0; // Ensure unsigned 32-bit integer
};

// string hash function (using djb2). Not cryptographically secure, use only
// for versioning and such.
export const hashString = (s: string): number => {
  let hash: number = 5381;
  for (let i = 0; i < s.length; i++) {
    const char: number = s.charCodeAt(i);
    hash = (hash << 5) + hash + char;
  }
  return hash >>> 0; // Ensure unsigned 32-bit integer
};

export const getVisibleElements = (elements: readonly ExcalidrawElement[]) =>
  elements.filter(
    (el) => !el.isDeleted && !isInvisiblySmallElement(el),
  ) as readonly NonDeletedExcalidrawElement[];

export const getNonDeletedElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
) =>
  elements.filter((element) => !element.isDeleted) as readonly NonDeleted<T>[];

export const isNonDeletedElement = <T extends ExcalidrawElement>(
  element: T,
): element is NonDeleted<T> => !element.isDeleted;

const _clearElements = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] =>
  getNonDeletedElements(elements).map((element) =>
    isLinearElementType(element.type)
      ? { ...element, lastCommittedPoint: null }
      : element,
  );

export const clearElementsForDatabase = (
  elements: readonly ExcalidrawElement[],
) => _clearElements(elements);

export const clearElementsForExport = (
  elements: readonly ExcalidrawElement[],
) => _clearElements(elements);

export const clearElementsForLocalStorage = (
  elements: readonly ExcalidrawElement[],
) => _clearElements(elements);
