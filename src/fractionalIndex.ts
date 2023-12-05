import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

type FractionalIndex = ExcalidrawElement["fractionalIndex"];

const isValidFractionalIndex = (
  index: FractionalIndex,
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (index) {
    if (!predecessor && !successor) {
      return index.length > 0;
    }

    if (!predecessor) {
      // first element
      return index < successor!;
    }

    if (!successor) {
      // last element
      return predecessor! < index;
    }
  }

  return false;
};

const getContiguousMovedIndices = (
  elements: readonly ExcalidrawElement[],
  movedElementsMap: Map<string, ExcalidrawElement>,
) => {
  const result: number[][] = [];
  const contiguous: number[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (movedElementsMap.has(element.id)) {
      if (contiguous.length) {
        if (contiguous[contiguous.length - 1] + 1 === i) {
          contiguous.push(i);
        } else {
          result.push(contiguous.slice());
          contiguous.length = 0;
          contiguous.push(i);
        }
      } else {
        contiguous.push(i);
      }
    }
  }

  if (contiguous.length > 0) {
    result.push(contiguous.slice());
  }

  return result;
};

export const generateFractionalIndexBetween = (
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (predecessor && successor) {
    if (predecessor < successor) {
      return generateKeyBetween(predecessor, successor);
    }
    return null;
  }
  return generateKeyBetween(predecessor, successor);
};

export const fixFractionalIndices = (
  elements: readonly ExcalidrawElement[],
  movedElementsMap: Map<string, ExcalidrawElement>,
) => {
  const fixedElements = elements.slice();
  const contiguousMovedIndices = getContiguousMovedIndices(
    fixedElements,
    movedElementsMap,
  );

  for (const movedIndices of contiguousMovedIndices) {
    try {
      const predecessor =
        fixedElements[movedIndices[0] - 1]?.fractionalIndex || null;
      const successor =
        fixedElements[movedIndices[movedIndices.length - 1] + 1]
          ?.fractionalIndex || null;

      const newKeys = generateNKeysBetween(
        predecessor,
        successor,
        movedIndices.length,
      );

      for (let i = 0; i < movedIndices.length; i++) {
        const element = fixedElements[movedIndices[i]];

        mutateElement(
          element,
          {
            fractionalIndex: newKeys[i],
          },
          false,
        );
      }
    } catch (e) {
      console.error("error fixing fractional indices", e);
    }
  }

  return fixedElements;
};

const generateFractionalIndex = (
  index: FractionalIndex,
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (index) {
    if (!predecessor && !successor) {
      return index;
    }

    if (!predecessor) {
      // first element in the array
      // insert before successor
      return generateKeyBetween(null, successor);
    }

    if (!successor) {
      // last element in the array
      // insert after predecessor
      return generateKeyBetween(predecessor, null);
    }

    // both predecessor and successor exist
    // insert after predecessor
    return generateKeyBetween(predecessor, null);
  }

  return generateKeyBetween(null, null);
};

const compareStrings = (a: string, b: string) => {
  return a < b ? -1 : 1;
};

export const orderByFractionalIndex = (allElements: ExcalidrawElement[]) => {
  return allElements.sort((a, b) => {
    if (a.fractionalIndex && b.fractionalIndex) {
      if (a.fractionalIndex < b.fractionalIndex) {
        return -1;
      } else if (a.fractionalIndex > b.fractionalIndex) {
        return 1;
      }
      return compareStrings(a.id, b.id);
    }

    return 0;
  });
};

/**
 * normalize the fractional indicies of the elements in the given array such that
 * every element in the array has a fractional index smaller than its successor's
 *
 * note that this function is not pure, it mutates elements whose fractional indicies
 * need updating
 */
export const normalizeFractionalIndicies = (
  allElements: readonly ExcalidrawElement[],
) => {
  let pre = -1;
  let suc = 1;

  const normalized: ExcalidrawElement[] = [];

  for (const element of allElements) {
    const predecessor = allElements[pre]?.fractionalIndex || null;
    const successor = allElements[suc]?.fractionalIndex || null;

    if (
      !isValidFractionalIndex(element.fractionalIndex, predecessor, successor)
    ) {
      try {
        const nextFractionalIndex = generateFractionalIndex(
          element.fractionalIndex,
          predecessor,
          successor,
        );

        normalized.push({
          ...element,
          fractionalIndex: nextFractionalIndex,
        });
      } catch (e) {
        console.error("normalizing fractional index", e);
        normalized.push(element);
      }
    } else {
      normalized.push(element);
    }
    pre++;
    suc++;
  }

  return normalized;
};
