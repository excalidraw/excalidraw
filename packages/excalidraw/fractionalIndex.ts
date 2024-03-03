import { generateNKeysBetween } from "fractional-indexing";
import { mutateElement } from "./element/mutateElement";
import {
  ExcalidrawElement,
  FractionalIndex,
  OrderedExcalidrawElement,
} from "./element/types";
import { InvalidFractionalIndexError } from "./errors";

/**
 * Happy concurrent collab flow without jitter:
 *
 * concurrent changes for clients 1) and 2):
 * 1) A, B, (C - a3) ("sync" performed by client 1, with / without moved elements)
 * 2) A, B, (D)      ("sync" not performed on client 2 - backwards comp. - worst case)
 *
 * restore ("sync" fixing just D in client 2): (here it could be just "restore of indices")
 * 1) A, B, (C - a3)
 * 2) A, B, (D - a3)
 *
 * reconciliation (reconcile -> order by index, id):
 * 1) A, B, D (a3), C (a3) -> A, B, C (a3), D (a3)
 * 2) A, B, C (a3), D (a3) -> A, B, C (a3), D (a3)
 *
 * updateScene -> replaceAllElements ("sync" fixing D in both client 1 & 2): (here I need consistent restore + fix of all invalid indices - for reliabilityr reasons same as during "restore")
 * 1) A, B, C (a3), D (a4)
 * 2) A, B, C (a3), D (a4)
 */

// TODO_FI_3: it's already SSOT, array is just a "helper" for caching order (otherwise one would have to reorder each time) & backwards compatibility & abstracting away internal indices (i.e. automatically fallback).

/**
 * Envisioned relation between array order and fractional indices:
 *
 * 1) array and its order should be still prefered in most situations, mostly from the outside (boundaries) as fractional indices are internal behaviour:
 * - it's easy enough to define the order of all element from the outside, without worrying about the underlying structure of fractional indices (i.e. host apps)
 * - we need to always keep the array support for backwards compatibility (restore) - old scenes, old libraries, supporting multiple excalidraw versions etc.
 * - it's impossible to guess the actually moved elements out from the next elements alone - we might end up modfiying the elements which didn't move,
 *   therefore for more granular control over z-index from the outside, we could additionally allow passing the actually moved elements (as we do internally)
 *
 * 2) fractional indices should be prefered internally over the array-order:
 * - whenever we have fractional indices present and expect the change in order, we order the elements by fractional indices (reconcillitation, undo / redo .etc)
 * - as the indices are encoded as part of the element, it opens up possibilties for incremental-like APIs
 *
 * In both cases we should make sure that our fractional indices are always synced with the array order. Elements with invalid indices should be detected and fixed,
 * without altering the already valid indices.
 *
 * Additionally, we should not get too coupled internally to fractional indices, as the actual underlying implementation might change in the future
 * (i.e. incorporating jitter, different charset, custom index structure etc.) or we might choose a different / additional structure (i.e. double linked list).
 * Also, in most cases it's more straighforward and less error prone to perform a simple internal array operation on top of all elements and
 * let the indices automatically sync with array order later, rather than having to deal with fractional indices.
 *
 * At some point it might be beneficial to deprecate the array and choose a different data structure (in each case we will need to keep the array sync for backwards compatibility) or treat indices as SSOT, few options:
 *
 * a) replace array with another ordered structure (i.e. ordered map, ordered tree, etc.)
 *    - we already have out of the box support for automatically syncing the indices with given ordered structure, by converting the structure to array and let it perform a sync
 * b) treat fractional indices as SSOT instead of relying on array-order:
 *    - always order based on fractional indices (as few times as possible) & ensure ordered type-safety
 *    - only sync indices on boundaries when moved elements are unknown / expected incorrect (collab, host apps, reconciliation, etc.) or for backwards compatibility (restore)
 *    - instead of performing sync on following actions, get the boundaries of moved elements first, generate the fractional indices in situ and re-order based on them afterwards
 *      - new element/s insertion
 *      - z-index-like actions (including grouping, duplicating, bounding text, etc.)
 *      - drop scene, lib import, paste element/s, etc.
 *    - offer alternative (i.e. incremental) APIs for hiding the fractional indexing implementation details
 *      - check related https://github.com/excalidraw/excalidraw/pull/7359#discussion_r1435020844
 */
/**
 * Ensure that @param elements have valid fractional indices.
 *
 * @throws `InvalidFractionalIndexError` if invalid index is detected.
 */
export const validateFractionalIndices = (
  indices: (ExcalidrawElement["index"] | undefined)[],
) => {
  for (const [i, index] of indices.entries()) {
    const predecessorIndex = indices[i - 1];
    const successorIndex = indices[i + 1];

    if (!isValidFractionalIndex(index, predecessorIndex, successorIndex)) {
      throw new InvalidFractionalIndexError(
        `Fractional indices invariant for element has been compromised - ["${predecessorIndex}", "${index}", "${successorIndex}"] [predecessor, current, successor]`,
      );
    }
  }
};

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical, break the tie based on the element.id
 * - when there is no fractional index in one of the elements, respect the order of the array
 */
export const orderByFractionalIndex = (
  elements: OrderedExcalidrawElement[],
) => {
  return elements.sort((a, b) => {
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
    // in case the indices are not the defined at runtime
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

    // ensure next indices are valid before mutation, throws on invalid ones
    validateFractionalIndices(
      elements.map((x) => elementsUpdates.get(x)?.index || x.index),
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
 * WARN: could modify elements which were not moved, therefore it is preferred to use `syncMovedIndices` instead.
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
    if (
      movedElements.has(elements[i].id) &&
      !isValidFractionalIndex(
        elements[i]?.index,
        elements[i - 1]?.index,
        elements[i + 1]?.index,
      )
    ) {
      const indicesGroup = [i - 1, i]; // push the lower bound index as the first item

      while (++i < elements.length) {
        if (
          !(
            movedElements.has(elements[i].id) &&
            !isValidFractionalIndex(
              elements[i]?.index,
              elements[i - 1]?.index,
              elements[i + 1]?.index,
            )
          )
        ) {
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
  // meaning the element was already ordered in the past
  // meaning it is not a newly inserted element, not an unrestored element, etc.
  // it does not have to mean that the index itself is valid
  if (element.index) {
    return true;
  }

  return false;
};
