// Helpers for collections of scene elements: versioning and deleted-element
// filtering. Kept out of index.ts so modules inside this package never have
// to import the package index (see index.ts).

import { toIterable } from "@excalidraw/common";

import { isInvisiblySmallElement } from "./sizeHelpers";

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
// note: hashes individual code units (not code points),
// but for hashing purposes this is fine as it iterates through every code unit
// (as such, no need to encode to byte string first)
export const hashString = (s: string): number => {
  let hash: number = 5381;
  for (let i = 0; i < s.length; i++) {
    const char: number = s.charCodeAt(i);
    hash = (hash << 5) + hash + char;
  }
  return hash >>> 0; // Ensure unsigned 32-bit integer
};

export const isNonDeletedElement = <T extends ExcalidrawElement>(
  element: T,
): element is NonDeleted<T> => !element.isDeleted;

export const getVisibleElements = (
  elements: readonly ExcalidrawElement[],
): readonly NonDeletedExcalidrawElement[] =>
  elements.filter(
    (el): el is NonDeletedExcalidrawElement =>
      isNonDeletedElement(el) && !isInvisiblySmallElement(el),
  );

export const getNonDeletedElements = <T extends ExcalidrawElement>(
  elements: readonly T[],
): readonly NonDeleted<T>[] => elements.filter(isNonDeletedElement);
