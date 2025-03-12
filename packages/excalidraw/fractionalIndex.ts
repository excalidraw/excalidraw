import { generateNKeysBetween } from "fractional-indexing";

import { mutateElement } from "./element/mutateElement";
import { getBoundTextElement } from "./element/textElement";
import { hasBoundTextElement } from "./element/typeChecks";
import { InvalidFractionalIndexError } from "./errors";
import { arrayToMap } from "./utils";

import type {
  ExcalidrawElement,
  FractionalIndex,
  OrderedExcalidrawElement,
} from "./element/types";

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
  movedElements: Map<string, ExcalidrawElement>,
): OrderedExcalidrawElement[] => {
  try {
    const indicesGroups = getMovedIndicesGroups(elements, movedElements);

    // try generatating indices, throws on invalid movedElements
    const elementsUpdates = generateIndices(elements, indicesGroups);
    const elementsCandidates = elements.map((x) =>
      elementsUpdates.has(x) ? { ...x, ...elementsUpdates.get(x) } : x,
    );

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
    for (const [element, update] of elementsUpdates) {
      mutateElement(element, update, false);
    }
  } catch (e) {
    // fallback to default sync
    syncInvalidIndices(elements);
  }

  return elements as OrderedExcalidrawElement[];
};

/**
 * Synchronizes all invalid fractional indices with the array order by mutating passed elements.
 *
 * WARN: in edge cases it could modify the elements which were not moved, as it's impossible to guess the actually moved elements from the elements array itself.
 */
export const syncInvalidIndices = (
  elements: readonly ExcalidrawElement[],
): OrderedExcalidrawElement[] => {
  const indicesGroups = getInvalidIndicesGroups(elements);
  const elementsUpdates = generateIndices(elements, indicesGroups);
  for (const [element, update] of elementsUpdates) {
    mutateElement(element, update, false);
  }

  return elements as OrderedExcalidrawElement[];
};

/**
 * Get contiguous groups of indices of passed moved elements.
 *
 * NOTE: First and last elements within the groups are indices of lower and upper bounds.
 */
const getMovedIndicesGroups = (
  elements: readonly ExcalidrawElement[],
  movedElements: Map<string, ExcalidrawElement>,
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
