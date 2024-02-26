import { generateNKeysBetween } from "fractional-indexing";
import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import { ENV } from "./constants";
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
export const ensureValidFractionalIndices = (
  elements: readonly ExcalidrawElement[],
) => {
  let shouldPerformFallbackSync = false;

  for (const [index, element] of elements.entries()) {
    const predecessorIndex = elements[index - 1]?.index || null;
    const successorIndex = elements[index + 1]?.index || null;

    if (
      !isValidFractionalIndex(element.index, predecessorIndex, successorIndex)
    ) {
      if (import.meta.env.DEV || import.meta.env.MODE === ENV.TEST) {
        throw new InvalidFractionalIndexError(
          `Fractional indices invariant for element "${element.id}" has been compromised - (predecessor) "${predecessorIndex}", "${element.index}", "${successorIndex}" (successor)`,
        );
      } else {
        // TODO_FI: could we somehow explicitly log in prod? (with a stacktrace)
        // let's make sure we have always valid indices in prod
        shouldPerformFallbackSync = true;
        break;
      }
    }
  }

  if (shouldPerformFallbackSync) {
    syncFractionalIndices(elements);
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
  const contiguousIndices = getContiguousMovedIndices(elements, movedElements);

  for (const indices of contiguousIndices) {
    const lowerBoundIndex = elements[indices[0] - 1]?.index;
    const upperBoundIndex = elements[indices[indices.length - 1] + 1]?.index;

    const nextIndices = generateNKeysBetween(
      lowerBoundIndex,
      upperBoundIndex,
      indices.length,
    );

    for (let i = 0; i < indices.length; i++) {
      const element = elements[indices[i]];

      mutateElement(
        element,
        {
          index: nextIndices[i],
        },
        false,
      );
    }
  }

  return elements;
};

// TODO_FI: movedElement expects restored & ordered elements (valid indices, ordered, no duplicates), without it expects anything

/**
 * Get contigous indices of moved elements, but only those which are invalid,
 * so that we do not regenerate already valid indices.
 */
/**
 * Gets contiguous indices of moved elements automatically detected inside the elements array.
 * When @param movedElements is passed, only gets contiguous indices of the moved elements.
 * Without @param movedElements, use when you don't know exactly which elements have moved or as a fallback to fix invalid indices.
 */
const getContiguousMovedIndices = (
  elements: readonly ExcalidrawElement[],
  movedElements?: Map<string, ExcalidrawElement>,
) => {
  const indicesGroups: number[][] = [];

  const hasElementMoved = (
    element: ExcalidrawElement,
    lowerBoundIndex: FractionalIndex,
    upperBoundIndex: FractionalIndex,
  ) =>
    movedElements
      ? movedElements.has(element.id)
      : !isValidFractionalIndex(
          element.index,
          lowerBoundIndex,
          upperBoundIndex,
        );

  const getLowerBoundIndex = (index: number): [string | undefined, number] => {
    // just look left, since we are incrementally going right (no need to do additional looping here)
    const candidate = elements[index - 1]?.index;

    if (
      (!lowerBound && candidate) ||
      (lowerBound && candidate && candidate > lowerBound)
    ) {
      return [candidate, index - 1];
    }

    // cache! take the latest lower bound
    return [lowerBound, lowerBoundIndex];
  };

  const getUpperBoundIndex = (index: number): [string | undefined, number] => {
    // cache! don't let it find the upper bound again
    if (index < upperBoundIndex) {
      return [upperBound, upperBoundIndex];
    }

    // set upperBoundIndex as the starting point
    let i = upperBoundIndex;
    while (i < elements.length) {
      const candidate = elements[i + 1]?.index;

      if (
        (!upperBound && candidate) ||
        (upperBound && candidate && candidate > upperBound)
      ) {
        return [candidate, i + 1];
      }

      i++;
    }

    // we reached the end, sky is the limit
    return [undefined, i];
  };

  // purposefully going from left as:
  // - the biggest likelihood to have the same index on multiple clients is on the first element, as we are inserting new elements at the right side
  // - in other words, if we would go from the right, two clients could often end up with different indices on the same, unchanged elements (i.e. client A inserts one element, but in the meantime client 2 inserts two)
  // - we could still end up in this situation, but only in case one client changes the first element in the array, which does not happen that often
  // - if it does happen, the indices will shift and this client will win (on most elements) in reconcilitation due to the mutation (version increase)
  // - in both ways, we might end up with duplicates which will need to be deduplicated during reconciliation
  let i = 0;
  let lowerBound: string | undefined = undefined;
  let upperBound: string | undefined = undefined;

  // once we find lowerBound / upperBound, it cannot be lower than that, so we cache it for better perf.
  let lowerBoundIndex: number = -1;
  let upperBoundIndex: number = 1;

  while (i < elements.length) {
    const element = elements[i];
    [lowerBound, lowerBoundIndex] = getLowerBoundIndex(i);
    [upperBound, upperBoundIndex] = getUpperBoundIndex(i);

    if (hasElementMoved(element, lowerBound, upperBound)) {
      const indicesGroup = [i];

      while (++i < elements.length) {
        const element = elements[i];
        [lowerBound, lowerBoundIndex] = getLowerBoundIndex(i);
        [upperBound, upperBoundIndex] = getUpperBoundIndex(i);

        if (!hasElementMoved(element, lowerBound, upperBound)) {
          break;
        }

        indicesGroup.push(i);
      }
      indicesGroups.push(indicesGroup);
    }

    i++;
  }

  return indicesGroups;
};

const isValidFractionalIndex = (
  index: FractionalIndex,
  predecessor: FractionalIndex,
  successor: FractionalIndex | undefined = undefined, // TODO_FI: revisit
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
