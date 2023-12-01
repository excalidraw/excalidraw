import { mutateElement } from "./element/mutateElement";
import { ExcalidrawElement } from "./element/types";
import { generateKeyBetween } from "fractional-indexing";

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

        mutateElement(
          element,
          {
            fractionalIndex: nextFractionalIndex,
          },
          false,
        );
      } catch (e) {
        console.error("normalizing fractional index", e);
      }
    }
    pre++;
    suc++;
  }

  return allElements;
};
