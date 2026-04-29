import { arrayToMap } from "@excalidraw/common";

import { mutateElement, newElementWith } from "./mutateElement";
import { getBoundTextElement } from "./textElement";
import { hasBoundTextElement } from "./typeChecks";

import type {
  ElementsMap,
  ExcalidrawElement,
  FractionalIndex,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "./types";

export class InvalidFractionalIndexError extends Error {
  public code = "ELEMENT_HAS_INVALID_INDEX" as const;
}

/**
 * Envisioned relation between array order and fractional indices:
 *
 * 1) Array (or array-like ordered data structure) should be used as a cache of elements order, hiding the internal fractional indices implementation.
 * - it's undesirable to perform reorder for each related operation, therefore it's necessary to cache the order defined by fractional indices into an ordered data structure
 * - it's easy enough to define the order of the elements from the outside (boundaries), without worrying about the underlying structure of fractional indices (especially for the host apps)
 * - it's necessary to always keep the array support for backwards compatibility (restore) - old scenes, old libraries, supporting multiple excalidraw versions etc.
 * - it's necessary to always keep the fractional indices in sync with the array order
 * - elements with invalid indices should be detected and synced, without altering the already valid indices
 *
 * 2) Fractional indices should be used to reorder the elements, whenever the cached order is expected to be invalidated.
 * - as the fractional indices are encoded as part of the elements, it opens up possibilities for incremental-like APIs
 * - re-order based on fractional indices should be part of (multiplayer) operations such as reconciliation & undo/redo
 * - technically all the z-index actions could perform also re-order based on fractional indices,but in current state it would not bring much benefits,
 *   as it's faster & more efficient to perform re-order based on array manipulation and later synchronisation of moved indices with the array order
 */

/**
 * Ensure that all elements have valid fractional indices.
 *
 * @throws `InvalidFractionalIndexError` if invalid index is detected.
 */
export const validateFractionalIndices = (
  elements: readonly ExcalidrawElement[],
  {
    shouldThrow = false,
    includeBoundTextValidation = false,
    ignoreLogs,
    reconciliationContext,
  }: {
    shouldThrow: boolean;
    includeBoundTextValidation: boolean;
    ignoreLogs?: true;
    reconciliationContext?: {
      localElements: ReadonlyArray<ExcalidrawElement>;
      remoteElements: ReadonlyArray<ExcalidrawElement>;
    };
  },
) => {
  const errorMessages = [];
  const stringifyElement = (element: ExcalidrawElement | void) =>
    `${element?.index}:${element?.id}:${element?.type}:${element?.isDeleted}:${element?.version}:${element?.versionNonce}`;

  const indices = elements.map((x) => x.index);
  for (const [i, index] of indices.entries()) {
    const predecessorIndex = indices[i - 1];
    const successorIndex = indices[i + 1];

    if (!isValidFractionalIndex(index, predecessorIndex, successorIndex)) {
      errorMessages.push(
        `Fractional indices invariant has been compromised: "${stringifyElement(
          elements[i - 1],
        )}", "${stringifyElement(elements[i])}", "${stringifyElement(
          elements[i + 1],
        )}"`,
      );
    }

    // disabled by default, as we don't fix it
    if (includeBoundTextValidation && hasBoundTextElement(elements[i])) {
      const container = elements[i];
      const text = getBoundTextElement(container, arrayToMap(elements));

      if (text && text.index! <= container.index!) {
        errorMessages.push(
          `Fractional indices invariant for bound elements has been compromised: "${stringifyElement(
            text,
          )}", "${stringifyElement(container)}"`,
        );
      }
    }
  }

  if (errorMessages.length) {
    const error = new InvalidFractionalIndexError();
    const additionalContext = [];

    if (reconciliationContext) {
      additionalContext.push("Additional reconciliation context:");
      additionalContext.push(
        reconciliationContext.localElements.map((x) => stringifyElement(x)),
      );
      additionalContext.push(
        reconciliationContext.remoteElements.map((x) => stringifyElement(x)),
      );
    }

    if (!ignoreLogs) {
      // report just once and with the stacktrace
      console.error(
        errorMessages.join("\n\n"),
        error.stack,
        elements.map((x) => stringifyElement(x)),
        ...additionalContext,
      );
    }

    if (shouldThrow) {
      // if enabled, gather all the errors first, throw once
      throw error;
    }
  }
};

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical, break the tie based on the element id
 * - when there is no fractional index in one of the elements, respect the order of the array
 */
export const orderByFractionalIndex = (
  elements: OrderedExcalidrawElement[],
) => {
  return elements.sort((a, b) => {
    // in case the indices are not the defined at runtime
    if (isOrderedElement(a) && isOrderedElement(b)) {
      if (a.index < b.index) {
        return -1;
      } else if (a.index > b.index) {
        return 1;
      }

      // break ties based on the element id
      return a.id < b.id ? -1 : 1;
    }

    // defensively keep the array order
    return 1;
  });
};

/**
 * Synchronizes invalid fractional indices of moved elements with the array order by mutating passed elements.
 * If the synchronization fails or the result is invalid, it fallbacks to `syncInvalidIndices`.
 */
export const syncMovedIndices = (
  elements: readonly ExcalidrawElement[],
  movedElements: ElementsMap,
): OrderedExcalidrawElement[] => {
  try {
    const elementsMap = arrayToMap(elements);
    const indicesGroups = getMovedIndicesGroups(elements, movedElements);

    // try generatating indices, throws on invalid movedElements
    const elementsUpdates = generateIndices(elements, indicesGroups);
    const elementsCandidates = elements.map((x) => {
      const elementUpdates = elementsUpdates.get(x);

      if (elementUpdates) {
        return { ...x, index: elementUpdates.index };
      }

      return x;
    });

    // ensure next indices are valid before mutation, throws on invalid ones
    validateFractionalIndices(
      elementsCandidates,
      // we don't autofix invalid bound text indices, hence don't include it in the validation
      {
        includeBoundTextValidation: false,
        shouldThrow: true,
        ignoreLogs: true,
      },
    );

    // split mutation so we don't end up in an incosistent state
    for (const [element, { index }] of elementsUpdates) {
      mutateElement(element, elementsMap, { index });
    }
  } catch (e) {
    // fallback to default sync
    syncInvalidIndices(elements);
  }

  return elements as OrderedExcalidrawElement[];
};

/**
 * Synchronizes all invalid fractional indices within the array order by mutating elements in the passed array.
 *
 * WARN: in edge cases it could modify the elements which were not moved, as it's impossible to guess the actually moved elements from the elements array itself.
 */
export const syncInvalidIndices = (
  elements: readonly ExcalidrawElement[],
): OrderedExcalidrawElement[] => {
  const elementsMap = arrayToMap(elements);
  const indicesGroups = getInvalidIndicesGroups(elements);
  const elementsUpdates = generateIndices(elements, indicesGroups);

  for (const [element, { index }] of elementsUpdates) {
    mutateElement(element, elementsMap, { index });
  }

  return elements as OrderedExcalidrawElement[];
};

/**
 * Synchronizes all invalid fractional indices within the array order by creating new instances of elements with corrected indices.
 *
 * WARN: in edge cases it could modify the elements which were not moved, as it's impossible to guess the actually moved elements from the elements array itself.
 */
export const syncInvalidIndicesImmutable = (
  elements: readonly ExcalidrawElement[],
): SceneElementsMap | undefined => {
  const syncedElements = arrayToMap(elements);
  const indicesGroups = getInvalidIndicesGroups(elements);
  const elementsUpdates = generateIndices(elements, indicesGroups);

  for (const [element, { index }] of elementsUpdates) {
    syncedElements.set(element.id, newElementWith(element, { index }));
  }

  return syncedElements as SceneElementsMap;
};

/**
 * Get contiguous groups of indices of passed moved elements.
 *
 * NOTE: First and last elements within the groups are indices of lower and upper bounds.
 */
const getMovedIndicesGroups = (
  elements: readonly ExcalidrawElement[],
  movedElements: ElementsMap,
) => {
  const indicesGroups: number[][] = [];

  let i = 0;

  while (i < elements.length) {
    if (movedElements.has(elements[i].id)) {
      const indicesGroup = [i - 1, i]; // push the lower bound index as the first item

      while (++i < elements.length) {
        if (!movedElements.has(elements[i].id)) {
          break;
        }

        indicesGroup.push(i);
      }

      indicesGroup.push(i); // push the upper bound index as the last item
      indicesGroups.push(indicesGroup);
    } else {
      i++;
    }
  }

  return indicesGroups;
};

/**
 * Gets contiguous groups of all invalid indices automatically detected inside the elements array.
 *
 * WARN: First and last items within the groups do NOT have to be contiguous, those are the found lower and upper bounds!
 */
const getInvalidIndicesGroups = (elements: readonly ExcalidrawElement[]) => {
  const indicesGroups: number[][] = [];

  // once we find lowerBound / upperBound, it cannot be lower than that, so we cache it for better perf.
  let lowerBound: ExcalidrawElement["index"] | undefined = undefined;
  let upperBound: ExcalidrawElement["index"] | undefined = undefined;
  let lowerBoundIndex: number = -1;
  let upperBoundIndex: number = 0;

  /** @returns maybe valid lowerBound */
  const getLowerBound = (
    index: number,
  ): [ExcalidrawElement["index"] | undefined, number] => {
    const lowerBound = elements[lowerBoundIndex]
      ? elements[lowerBoundIndex].index
      : undefined;

    // we are already iterating left to right, therefore there is no need for additional looping
    const candidate = elements[index - 1]?.index;

    if (
      (!lowerBound && candidate) || // first lowerBound
      (lowerBound && candidate && candidate > lowerBound) // next lowerBound
    ) {
      // WARN: candidate's index could be higher or same as the current element's index
      return [candidate, index - 1];
    }

    // cache hit! take the last lower bound
    return [lowerBound, lowerBoundIndex];
  };

  /** @returns always valid upperBound */
  const getUpperBound = (
    index: number,
  ): [ExcalidrawElement["index"] | undefined, number] => {
    const upperBound = elements[upperBoundIndex]
      ? elements[upperBoundIndex].index
      : undefined;

    // cache hit! don't let it find the upper bound again
    if (upperBound && index < upperBoundIndex) {
      return [upperBound, upperBoundIndex];
    }

    // set the current upperBoundIndex as the starting point
    let i = upperBoundIndex;
    while (++i < elements.length) {
      const candidate = elements[i]?.index;

      if (
        (!upperBound && candidate) || // first upperBound
        (upperBound && candidate && candidate > upperBound) // next upperBound
      ) {
        return [candidate, i];
      }
    }

    // we reached the end, sky is the limit
    return [undefined, i];
  };

  let i = 0;

  while (i < elements.length) {
    const current = elements[i].index;
    [lowerBound, lowerBoundIndex] = getLowerBound(i);
    [upperBound, upperBoundIndex] = getUpperBound(i);

    if (!isValidFractionalIndex(current, lowerBound, upperBound)) {
      // push the lower bound index as the first item
      const indicesGroup = [lowerBoundIndex, i];

      while (++i < elements.length) {
        const current = elements[i].index;
        const [nextLowerBound, nextLowerBoundIndex] = getLowerBound(i);
        const [nextUpperBound, nextUpperBoundIndex] = getUpperBound(i);

        if (isValidFractionalIndex(current, nextLowerBound, nextUpperBound)) {
          break;
        }

        // assign bounds only for the moved elements
        [lowerBound, lowerBoundIndex] = [nextLowerBound, nextLowerBoundIndex];
        [upperBound, upperBoundIndex] = [nextUpperBound, nextUpperBoundIndex];

        indicesGroup.push(i);
      }

      // push the upper bound index as the last item
      indicesGroup.push(upperBoundIndex);
      indicesGroups.push(indicesGroup);
    } else {
      i++;
    }
  }

  return indicesGroups;
};

const isValidFractionalIndex = (
  index: ExcalidrawElement["index"] | undefined,
  predecessor: ExcalidrawElement["index"] | undefined,
  successor: ExcalidrawElement["index"] | undefined,
) => {
  if (!index) {
    return false;
  }

  try {
    // Format validation
    validateOrderKey(index);
  } catch {
    return false;
  }

  if (predecessor && successor) {
    return predecessor < index && index < successor;
  }

  if (!predecessor && successor) {
    // first element
    return index < successor;
  }

  if (predecessor && !successor) {
    // last element
    return predecessor < index;
  }

  // only element in the array
  return !!index;
};

const generateIndices = (
  elements: readonly ExcalidrawElement[],
  indicesGroups: number[][],
) => {
  const elementsUpdates = new Map<
    ExcalidrawElement,
    { index: FractionalIndex }
  >();

  for (const indices of indicesGroups) {
    const lowerBoundIndex = indices.shift()!;
    const upperBoundIndex = indices.pop()!;

    const fractionalIndices = generateNKeysBetween(
      elements[lowerBoundIndex]?.index,
      elements[upperBoundIndex]?.index,
      indices.length,
    ) as FractionalIndex[];

    for (let i = 0; i < indices.length; i++) {
      const element = elements[indices[i]];

      elementsUpdates.set(element, {
        index: fractionalIndices[i],
      });
    }
  }

  return elementsUpdates;
};

const isOrderedElement = (
  element: ExcalidrawElement,
): element is OrderedExcalidrawElement => {
  // for now it's sufficient whether the index is there
  // meaning, the element was already ordered in the past
  // meaning, it is not a newly inserted element, not an unrestored element, etc.
  // it does not have to mean that the index itself is valid
  if (element.index) {
    return true;
  }

  return false;
};

// Vendored from https://www.npmjs.com/package/fractional-indexing
// License: CC0 (no rights reserved).
// This is based on https://observablehq.com/@dgreensp/implementing-fractional-indexing

export const BASE_62_DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// `a` may be empty string, `b` is null or non-empty string.
// `a < b` lexicographically if `b` is non-null.
// no trailing zeros allowed.
// digits is a string such as '0123456789' for base 10.  Digits must be in
// ascending character code order!
/**
 * @param {string} a
 * @param {string | null | undefined} b
 * @param {string} digits
 * @returns {string}
 */
function midpoint(
  a: string,
  b: string | null | undefined,
  digits: string,
): string {
  const zero = digits[0];
  if (b != null && a >= b) {
    throw new Error(`${a} >= ${b}`);
  }
  if (a.slice(-1) === zero || (b && b.slice(-1) === zero)) {
    throw new Error("trailing zero");
  }
  if (b) {
    // remove longest common prefix.  pad `a` with 0s as we
    // go.  note that we don't need to pad `b`, because it can't
    // end before `a` while traversing the common prefix.
    let n = 0;
    while ((a[n] || zero) === b[n]) {
      n++;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n), digits);
    }
  }
  // first digits (or lack of digit) are different
  const digitA = a ? digits.indexOf(a[0]) : 0;
  const digitB = b != null ? digits.indexOf(b[0]) : digits.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return digits[midDigit];
  }
  // first digits are consecutive
  if (b && b.length > 1) {
    return b.slice(0, 1);
  }

  // `b` is null or has length 1 (a single digit).
  // the first digit of `a` is the previous digit to `b`,
  // or 9 if `b` is null.
  // given, for example, midpoint('49', '5'), return
  // '4' + midpoint('9', null), which will become
  // '4' + '9' + midpoint('', null), which is '495'
  return digits[digitA] + midpoint(a.slice(1), null, digits);
}

/**
 * @param {string} int
 * @return {void}
 */

function validateInteger(int: string): void {
  if (int.length !== getIntegerLength(int[0])) {
    throw new Error(`invalid integer part of order key: ${int}`);
  }
}

/**
 * @param {string} head
 * @return {number}
 */

function getIntegerLength(head: string): number {
  if (head >= "a" && head <= "z") {
    return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
  } else if (head >= "A" && head <= "Z") {
    return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
  }

  throw new Error(`invalid order key head: ${head}`);
}

/**
 * @param {string} key
 * @return {string}
 */

function getIntegerPart(key: string): string {
  const integerPartLength = getIntegerLength(key[0]);

  if (integerPartLength > key.length) {
    throw new Error(`invalid order key: ${key}`);
  }
  return key.slice(0, integerPartLength);
}

/**
 * @param {string} key
 * @param {string} digits
 * @return {void}
 */
function validateOrderKey(key: string, digits: string = BASE_62_DIGITS): void {
  if (key === `A${digits[0].repeat(26)}`) {
    throw new Error(`invalid order key: ${key}`);
  }
  // getIntegerPart will throw if the first character is bad,
  // or the key is too short.  we'd call it to check these things
  // even if we didn't need the result
  const i = getIntegerPart(key);
  const f = key.slice(i.length);
  if (f.slice(-1) === digits[0]) {
    throw new Error(`invalid order key: ${key}`);
  }
}

// note that this may return null, as there is a largest integer
/**
 * @param {string} x
 * @param {string} digits
 * @return {string | null}
 */
function incrementInteger(x: string, digits: string): string | null {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) + 1;
    if (d === digits.length) {
      digs[i] = digits[0];
    } else {
      digs[i] = digits[d];
      carry = false;
    }
  }
  if (carry) {
    if (head === "Z") {
      return `a${digits[0]}`;
    }
    if (head === "z") {
      return null;
    }
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > "a") {
      digs.push(digits[0]);
    } else {
      digs.pop();
    }
    return h + digs.join("");
  }
  return head + digs.join("");
}

// note that this may return null, as there is a smallest integer
/**
 * @param {string} x
 * @param {string} digits
 * @return {string | null}
 */
function decrementInteger(x: string, digits: string): string | null {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = digits.indexOf(digs[i]) - 1;
    if (d === -1) {
      digs[i] = digits.slice(-1);
    } else {
      digs[i] = digits[d];
      borrow = false;
    }
  }
  if (borrow) {
    if (head === "a") {
      return `Z${digits.slice(-1)}`;
    }
    if (head === "A") {
      return null;
    }
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < "Z") {
      digs.push(digits.slice(-1));
    } else {
      digs.pop();
    }
    return h + digs.join("");
  }
  return head + digs.join("");
}

// `a` is an order key or null (START).
// `b` is an order key or null (END).
// `a < b` lexicographically if both are non-null.
// digits is a string such as '0123456789' for base 10.  Digits must be in
// ascending character code order!
/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @param {string=} digits
 * @return {string}
 */
export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  digits = BASE_62_DIGITS,
): string {
  if (a != null) {
    validateOrderKey(a, digits);
  }
  if (b != null) {
    validateOrderKey(b, digits);
  }
  if (a != null && b != null && a >= b) {
    throw new Error(`${a} >= ${b}`);
  }
  if (a == null) {
    if (b == null) {
      return `a${digits[0]}`;
    }

    const ib = getIntegerPart(b);
    const fb = b.slice(ib.length);
    if (ib === `A${digits[0].repeat(26)}`) {
      return ib + midpoint("", fb, digits);
    }
    if (ib < b) {
      return ib;
    }
    const res = decrementInteger(ib, digits);
    if (res == null) {
      throw new Error("cannot decrement any more");
    }
    return res;
  }

  if (b == null) {
    const ia = getIntegerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia, digits);
    return i == null ? ia + midpoint(fa, null, digits) : i;
  }

  const ia = getIntegerPart(a);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb, digits);
  }
  const i = incrementInteger(ia, digits);
  if (i == null) {
    throw new Error("cannot increment any more");
  }
  if (i < b) {
    return i;
  }
  return ia + midpoint(fa, null, digits);
}

/**
 * same preconditions as generateKeysBetween.
 * n >= 0.
 * Returns an array of n distinct keys in sorted order.
 * If a and b are both null, returns [a0, a1, ...]
 * If one or the other is null, returns consecutive "integer"
 * keys.  Otherwise, returns relatively short keys between
 * a and b.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @param {number} n
 * @param {string} digits
 * @return {string[]}
 */
export function generateNKeysBetween(
  a: string | null | undefined,
  b: string | null | undefined,
  n: number,
  digits = BASE_62_DIGITS,
): string[] {
  if (n === 0) {
    return [];
  }
  if (n === 1) {
    return [generateKeyBetween(a, b, digits)];
  }
  if (b == null) {
    let c = generateKeyBetween(a, b, digits);
    const result = [c];
    for (let i = 0; i < n - 1; i++) {
      c = generateKeyBetween(c, b, digits);
      result.push(c);
    }
    return result;
  }
  if (a == null) {
    let c = generateKeyBetween(a, b, digits);
    const result = [c];
    for (let i = 0; i < n - 1; i++) {
      c = generateKeyBetween(a, c, digits);
      result.push(c);
    }
    result.reverse();
    return result;
  }
  const mid = Math.floor(n / 2);
  const c = generateKeyBetween(a, b, digits);
  return [
    ...generateNKeysBetween(a, c, mid, digits),
    c,
    ...generateNKeysBetween(c, b, n - mid - 1, digits),
  ];
}
