import { generateNKeysBetween } from "fractional-indexing";
import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import { InvalidFractionalIndexError } from "./errors";

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
 * b) treat fractional indices as SSOT instead of relying on array-order: // TODO_FI_0: I might not need movedElements
 *    - always order based on fractional indices to the ordered structure
 *    - never fix incorrect indices, unless it's for backwards compatibility (restore) or unless merging two "scenes" together (collab, drop scene, lib import, etc.)
 *      - instead of sync on element/s insertion, get the fractional indices boundaries and insert the element/s within these boundaries
 *      - instead of sync on internal z-index-like actions, get the fractional indices indices boundaries and insert the element/s within these boundaries
 *      - instead of sync on restore, assume the elements are ordered already
 *    - offer alternative (i.e. incremental) APIs for hiding the fractional indexing implementation details for the host-apps
 *      - check related https://github.com/excalidraw/excalidraw/pull/7359#discussion_r1435020844
 */
type FractionalIndex = ExcalidrawElement["index"];

/**
 * Ensure that @param elements have valid fractional indices.
 *
 * @throws `InvalidFractionalIndexError` if invalid index is detected.
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

// TODO_FI_3: should return ordered elements
/**
 * Synchronizes fractional indices of @param movedElements with the array order by mutating passed @param elements.
 * If the synchronization of @param movedElements fails or the result is not valid, it fallbacks to synchronizing all the invalid indices with the array order.
 * If @param movedElements are not passed, it synchronizes all the invalid indices with the array order.
 *
 * Can handle both undefined/null indices (restore, element/s insertions) and unordered indices (as a result of z-index actions, reconcilliation, updateScene, etc.).
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
      // TODO_FI_2: do we have a possibility logging this into our telemetry?
      // prefer to fallback to default sync over failing completely
      syncFractionalIndices(elements, undefined);
    } else {
      throw e;
    }
  }

  return elements;
};

/**
 * Get contiguous groups of indices of passed @param movedElements.
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

  // purposefully going from left as:
  // - the biggest likelihood to have the same index on multiple clients is on the first element, as we are inserting new elements at the right side
  // - in other words, if we would go from the right, two clients could often end up with different indices on the same, unchanged elements (i.e. client A inserts one element, but in the meantime client 2 inserts two)
  // - we could still end up in this situation, but only in case one client changes the first element in the array, which does not happen that often (// TODO_FI_1: add tests)
  // - if it does happen, the indices will shift and this client will win (on most elements) in reconcilitation due to the mutation (version increase)
  // - in both ways, we might end up with duplicates which will need to be deduplicated during reconciliation
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
