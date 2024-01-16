import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import {
  generateKeyBetween as _generateKeyBetween,
  generateNKeysBetween as _generateNKeysBetween,
  generateJitteredKeyBetween,
  generateNJitteredKeysBetween,
  indexCharacterSet,
} from "fractional-indexing-jittered";
import { ENV } from "./constants";
import { InvalidFractionalIndexError } from "./errors";

type FractionalIndex = ExcalidrawElement["index"];

export const base36CharSet = indexCharacterSet({
  chars: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  firstPositive: "A",
  mostPositive: "Z",
});

export const generateKeyBetween = (
  lower: string | null,
  upper: string | null,
) =>
  import.meta.env.DEV || import.meta.env.MODE === ENV.TEST
    ? _generateKeyBetween(lower, upper, base36CharSet)
    : generateJitteredKeyBetween(lower, upper);

export const generateNKeysBetween = (
  lower: string | null,
  upper: string | null,
  n: number,
) =>
  import.meta.env.DEV || import.meta.env.MODE === ENV.TEST
    ? _generateNKeysBetween(lower, upper, n, base36CharSet)
    : generateNJitteredKeysBetween(lower, upper, n);

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical (in prod only during jitter collisions), break the tie based on the element.id.
 * - when there is no fractional index in one of the elements, respect the order of the array.
 */
export const orderByFractionalIndex = (elements: ExcalidrawElement[]) => {
  return elements.sort((a, b) => {
    if (a.index && b.index) {
      if (a.index < b.index) {
        return -1;
      } else if (a.index > b.index) {
        return 1;
      }

      // break ties based on the element id
      return a.id < b.id ? -1 : 1;
    }

    // respect the order of the array
    return 1;
  });
};

/**
 * Restore the fractional indices by mutating @param elements such that
 * every element in the array has a fractional index smaller than its successor's.
 *
 * Neighboring indices (altough correct) might get updated as well.
 *
 * Only use this function when restoring or as a fallback to guarantee fractional
 * indices consistency.
 */
export const restoreFractionalIndices = (
  elements: readonly ExcalidrawElement[],
) => {
  for (const [index, element] of elements.entries()) {
    const predecessorIndex = elements[index - 1]?.index || null;
    const successorIndex = elements[index + 1]?.index || null;

    if (
      !isValidFractionalIndex(element.index, predecessorIndex, successorIndex)
    ) {
      const fractionalIndex = restoreFractionalIndex(
        predecessorIndex,
        successorIndex,
      );
      mutateElement(
        element,
        {
          index: fractionalIndex,
        },
        false,
      );
    }
  }

  return elements as ExcalidrawElement[];
};

/**
 * Ensure that @param elements have valid fractional indices.
 *
 * @throws `InvalidFractionalIndexError` if invalid index is detected.
 */
export const validateFractionalIndices = (
  elements: readonly ExcalidrawElement[],
) => {
  for (const [index, element] of elements.entries()) {
    const predecessorIndex = elements[index - 1]?.index || null;
    const successorIndex = elements[index + 1]?.index || null;

    if (
      !isValidFractionalIndex(element.index, predecessorIndex, successorIndex)
    ) {
      if (import.meta.env.DEV || import.meta.env.MODE === ENV.TEST) {
        console.error(
          `Fractional index of element, predecessor and successor respectively: "${element.index}", "${predecessorIndex}", "${successorIndex}"`,
        );
        throw new InvalidFractionalIndexError(
          `Fractional indices invariant for element "${element.id}" has been compromised.`,
        );
      }
    }
  }
};

/**
 * Update fractional indices by mutating elements passed as @param reorderedElements.
 *
 * As opposed to `restoreFractionalIndices`, this one does not alter neighboring indices.
 */
export const updateFractionalIndices = (
  elements: readonly ExcalidrawElement[],
  reorderedElements: Map<string, ExcalidrawElement>,
) => {
  const contiguousMovedIndices = getContiguousMovedIndices(
    elements,
    reorderedElements,
  );

  for (const indices of contiguousMovedIndices) {
    const lowerBoundIndex = elements[indices[0] - 1]?.index || null;
    const upperBoundIndex =
      elements[indices[indices.length - 1] + 1]?.index || null;

    const fractionalIndices = generateNKeysBetween(
      lowerBoundIndex,
      upperBoundIndex,
      indices.length,
    );

    for (let i = 0; i < indices.length; i++) {
      const element = elements[indices[i]];

      mutateElement(
        element,
        {
          index: fractionalIndices[i],
        },
        false,
      );
    }
  }

  return elements as ExcalidrawElement[];
};

const getContiguousMovedIndices = (
  elements: readonly ExcalidrawElement[],
  reorderedElements: Map<string, ExcalidrawElement>,
) => {
  const result: number[][] = [];
  let contiguous: number[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (reorderedElements.has(element.id)) {
      if (contiguous.length) {
        if (contiguous[contiguous.length - 1] + 1 === i) {
          contiguous.push(i);
        } else {
          result.push(contiguous);
          contiguous = [i];
        }
      } else {
        contiguous.push(i);
      }
    }
  }

  if (contiguous.length > 0) {
    result.push(contiguous);
  }

  return result;
};

const restoreFractionalIndex = (
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (successor && !predecessor) {
    // first element in the array
    // insert before successor
    return generateKeyBetween(null, successor);
  }

  if (predecessor && !successor) {
    // last element in the array
    // insert after predecessor
    return generateKeyBetween(predecessor, null);
  }

  // both predecessor and successor exist (or both do not)
  // insert after predecessor
  return generateKeyBetween(predecessor, null);
};

const isValidFractionalIndex = (
  index: FractionalIndex,
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (!index) {
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

  // only element in the scene
  return !!index;
};
