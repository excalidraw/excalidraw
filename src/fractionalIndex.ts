import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import {
  generateJitteredKeyBetween,
  generateNJitteredKeysBetween,
} from "fractional-indexing-jittered";

type FractionalIndex = ExcalidrawElement["fractionalIndex"];

const isValidFractionalIndex = (
  index: FractionalIndex,
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (index) {
    if (predecessor && successor) {
      return predecessor < index && index < successor;
    }

    if (successor && !predecessor) {
      // first element
      return index < successor;
    }

    if (predecessor && !successor) {
      // last element
      return predecessor < index;
    }

    if (!predecessor && !successor) {
      return index.length > 0;
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

export const fixFractionalIndices = (
  elements: readonly ExcalidrawElement[],
  movedElementsMap: Map<string, ExcalidrawElement>,
) => {
  const contiguousMovedIndices = getContiguousMovedIndices(
    elements,
    movedElementsMap,
  );

  for (const movedIndices of contiguousMovedIndices) {
    try {
      const predecessor =
        elements[movedIndices[0] - 1]?.fractionalIndex || null;
      const successor =
        elements[movedIndices[movedIndices.length - 1] + 1]?.fractionalIndex ||
        null;

      const newKeys = generateNJitteredKeysBetween(
        predecessor,
        successor,
        movedIndices.length,
      );

      for (let i = 0; i < movedIndices.length; i++) {
        const element = elements[movedIndices[i]];

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

  return elements as ExcalidrawElement[];
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

const restoreFractionalIndex = (
  index: FractionalIndex,
  predecessor: FractionalIndex,
  successor: FractionalIndex,
) => {
  if (index) {
    if (!predecessor && !successor) {
      return index;
    }

    if (successor && !predecessor) {
      // first element in the array
      // insert before successor
      return generateJitteredKeyBetween(null, successor);
    }

    if (predecessor && !successor) {
      // last element in the array
      // insert after predecessor
      return generateJitteredKeyBetween(predecessor, null);
    }

    // both predecessor and successor exist
    // insert after predecessor
    return generateJitteredKeyBetween(predecessor, null);
  }

  return generateJitteredKeyBetween(null, null);
};

/**
 * restore the fractional indicies of the elements in the given array such that
 * every element in the array has a fractional index smaller than its successor's
 *
 * neighboring indices might be updated as well
 *
 * only use this function when restoring or as a fallback to guarantee fractional
 * indices consistency
 */
export const restoreFractionalIndicies = (
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
        const nextFractionalIndex = restoreFractionalIndex(
          element.fractionalIndex,
          predecessor,
          successor,
        );

        normalized.push({
          ...element,
          fractionalIndex: nextFractionalIndex,
        });
      } catch (e) {
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

export const validateFractionalIndicies = (
  elements: readonly ExcalidrawElement[],
) => {
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const successor = elements[i + 1];

    if (successor) {
      if (element.fractionalIndex && successor.fractionalIndex) {
        if (element.fractionalIndex >= successor.fractionalIndex) {
          console.log(
            "this is the case",
            element.fractionalIndex,
            successor.fractionalIndex,
          );
          return false;
        }
      } else {
        console.log(
          "this is the other case",
          element.fractionalIndex,
          successor.fractionalIndex,
        );
        return false;
      }
    }
  }

  return true;
};
