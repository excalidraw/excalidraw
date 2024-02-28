import { generateNKeysBetween } from "fractional-indexing";
import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import { InvalidFractionalIndexError } from "./errors";

/**
 * TODO_FI: revist
 * Envisioned relation between array order and fractional indices:
 *
 * 1) array (or array-like structure) and its order should prefered from the outside as fractional indices are internal behaviour
 * - it's easy enough to define the array order from the outside, without worrying about the underlying structure of fractional indices (i.e. host apps)
 * - elements with incorrent fractional index should be detected and fixed, without altering already valid indices
 * - for more granular control over z-index from the outside, we should allow passing the moved elements (as we are internally doing during insertion / z-index action),
 *   as it's not possibly to guess the moved elements from the prev/next elements alone
 * - we need to always keep the array support for backwards compatibility (restore) - old scenes, old libraries, different excalidraw versions etc.
 *
 * 2) fractional indices should be prefered internally over the array-order:
 * - whenever we have fractional index available and expect the change in order, we order the elements by fractional indices (reconcillitation, undo/redo)
 *
 * In both cases we should make sure that our fractional indices are always synced with the array order.
 * */
type FractionalIndex = ExcalidrawElement["index"];

/**
 * Ensure that @param elements have valid fractional indices.
 *
 * @throws `InvalidFractionalIndexError` if invalid index is detected.
 * @returns true if the indices are valid, throws otherwise.
 */
export const validateFractionalIndices = (indices: (string | undefined)[]) => {
  for (const [i, index] of indices.entries()) {
    const predecessorIndex = indices[i - 1];
    const successorIndex = indices[i + 1];

    if (!isValidFractionalIndex(index, predecessorIndex, successorIndex)) {
      throw new InvalidFractionalIndexError(
        `Fractional indices invariant for element has been compromised - ["${predecessorIndex}", "${index}", "${successorIndex}"] (predecessor, current, successor)`,
      );
    }
  }
};

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical, break the tie based on the element.id
 * - when there is no fractional index in one of the elements, respect the order of the array
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

// TODO_FI: should return ordered elements
/**
 * Synchronizes fractional indices of @param movedElements with the array order by mutating passed @param elements.
 * If @param movedElements is not passed, synchronizes all the invalid indices with the array order.
 */
export const syncFractionalIndices = (
  elements: readonly ExcalidrawElement[],
  movedElements?: Map<string, ExcalidrawElement>,
) => {
  try {
    // detect moved / invalid indices
    const indicesGroups = movedElements
      ? getMovedIndicesGroups(elements, movedElements)
      : getInvalidIndicesGroups(elements);

    const elementsUpdates = new Map<ExcalidrawElement, { index: string }>();

    // generate new indices
    for (const indices of indicesGroups) {
      const lowerBoundIndex = indices.shift()!;
      const upperBoundIndex = indices.pop()!;

      const nextIndices = generateNKeysBetween(
        elements[lowerBoundIndex]?.index,
        elements[upperBoundIndex]?.index,
        indices.length,
      );

      for (let i = 0; i < indices.length; i++) {
        const element = elements[indices[i]];

        elementsUpdates.set(element, { index: nextIndices[i] });
      }
    }

    // validate new indices before assigning
    validateFractionalIndices(
      elements.map((x) => elementsUpdates.get(x)?.index || x.index),
    );

    // split mutation so we don't end up in an incosistent state if one generation fails
    for (const [element, update] of elementsUpdates) {
      mutateElement(element, update, false);
    }
  } catch (e) {
    // ensure to not cycle here & let it re-throw on the second try
    if (movedElements) {
      // fallback to default sync
      syncFractionalIndices(elements, undefined);
    } else {
      throw e;
    }
  }

  return elements;
};

/**
 * Get contigous indices of moved elements, but only those which are invalid,
 * so that we do not regenerate already valid indices.
 *
 * WARN: first and last items within the groups do not have to be contiguous, those are found lower and upper bounds!
 */
/**
 * Gets contiguous indices of moved elements automatically detected inside the elements array.
 * When @param movedElements is passed, only gets contiguous indices of the moved elements.
 * Without @param movedElements, use when you don't know exactly which elements have moved or as a fallback to fix invalid indices.
 */
// purposefully going from left as:
// - the biggest likelihood to have the same index on multiple clients is on the first element, as we are inserting new elements at the right side
// - in other words, if we would go from the right, two clients could often end up with different indices on the same, unchanged elements (i.e. client A inserts one element, but in the meantime client 2 inserts two)
// - we could still end up in this situation, but only in case one client changes the first element in the array, which does not happen that often
// - if it does happen, the indices will shift and this client will win (on most elements) in reconcilitation due to the mutation (version increase)
// - in both ways, we might end up with duplicates which will need to be deduplicated during reconciliation

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

const getInvalidIndicesGroups = (elements: readonly ExcalidrawElement[]) => {
  const indicesGroups: number[][] = [];

  // once we find lowerBound / upperBound, it cannot be lower than that, so we cache it for better perf.
  let lowerBound: FractionalIndex = undefined;
  let upperBound: FractionalIndex = undefined;
  let lowerBoundIndex: number = -1;
  let upperBoundIndex: number = 0;

  /** @returns maybe valid lowerBound */
  const getLowerBound = (index: number): [string | undefined, number] => {
    const lowerBound = elements[lowerBoundIndex]?.index;

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
  const getUpperBound = (index: number): [string | undefined, number] => {
    const upperBound = elements[upperBoundIndex]?.index;

    // cache hit! don't let it find the upper bound again
    if (index < upperBoundIndex) {
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

  // only element in the array
  return !!index;
};
