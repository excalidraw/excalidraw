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
    // detect moved indices
    const indicesGroups = getMovedIndicesGroups(elements, movedElements);
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
      // TODO_FI: double-check the test-cases going through here
      // console.log(e);
      // fallback to default sync
      syncFractionalIndices(elements, undefined);
    } else {
      throw e;
    }
  }

  return elements;
};

// WARN: expects that we are going left to right right, so it looks only one item left
const getLowerBound = (
  elements: readonly ExcalidrawElement[],
  lowerBoundIndex: number,
  index: number,
): [string | undefined, number] => {
  const lowerBound = elements[lowerBoundIndex]?.index;

  // we are already iterating left to right, therefore tger is no need for additional looping
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

const getUpperBound = (
  elements: readonly ExcalidrawElement[],
  upperBoundIndex: number,
  index: number,
): [string | undefined, number] => {
  const upperBound = elements[upperBoundIndex]?.index;
  // cache! don't let it find the upper bound again
  if (index < upperBoundIndex) {
    return [upperBound, upperBoundIndex];
  }

  // set upperBoundIndex as the starting point
  let i = upperBoundIndex;
  while (++i < elements.length) {
    const candidate = elements[i]?.index;

    if (
      (!upperBound && candidate) ||
      (upperBound && candidate && candidate > upperBound)
    ) {
      return [candidate, i];
    }
  }

  // we reached the end, sky is the limit
  return [undefined, i];
};

// TODO_FI: movedElement expects restored & ordered elements (valid indices, ordered, no duplicates), without it expects anything
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
const getMovedIndicesGroups = (
  elements: readonly ExcalidrawElement[],
  movedElements?: Map<string, ExcalidrawElement>,
) => {
  const indicesGroups: number[][] = [];

  const hasElementMoved = (element: ExcalidrawElement) =>
    movedElements ? movedElements.has(element.id) : true;

  // purposefully going from left as:
  // - the biggest likelihood to have the same index on multiple clients is on the first element, as we are inserting new elements at the right side
  // - in other words, if we would go from the right, two clients could often end up with different indices on the same, unchanged elements (i.e. client A inserts one element, but in the meantime client 2 inserts two)
  // - we could still end up in this situation, but only in case one client changes the first element in the array, which does not happen that often
  // - if it does happen, the indices will shift and this client will win (on most elements) in reconcilitation due to the mutation (version increase)
  // - in both ways, we might end up with duplicates which will need to be deduplicated during reconciliation
  let i = 0;

  // once we find lowerBound / upperBound, it cannot be lower than that, so we cache it for better perf.
  let lowerBound: string | undefined = undefined;
  let upperBound: string | undefined = undefined;
  let lbi: number = -1; // lower bound index
  let ubi: number = 0; // upper bound index

  while (i < elements.length) {
    const element = elements[i];
    [lowerBound, lbi] = getLowerBound(elements, lbi, i);
    [upperBound, ubi] = getUpperBound(elements, ubi, i);

    if (
      hasElementMoved(element) &&
      !isValidFractionalIndex(element.index, lowerBound, upperBound)
    ) {
      const indicesGroup = [lbi, i]; // push the lower bound index as the first item

      while (++i < elements.length) {
        const element = elements[i];
        const [_lowerBound, _lbi] = getLowerBound(elements, lbi, i);
        const [_upperBound, _ubi] = getUpperBound(elements, ubi, i);

        if (
          !(
            hasElementMoved(element) &&
            !isValidFractionalIndex(element.index, _lowerBound, _upperBound)
          )
        ) {
          break;
        }

        // assign bounds only for the moved elements, not the valid ones
        lowerBound = _lowerBound;
        upperBound = _upperBound;
        lbi = _lbi;
        ubi = _ubi;

        indicesGroup.push(i);
      }

      indicesGroup.push(ubi); // push the upper bound index as the last item
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
