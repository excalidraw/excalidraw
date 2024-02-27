/* eslint-disable no-lone-blocks */
import {
  syncFractionalIndices,
  validateFractionalIndices,
} from "../fractionalIndex";
import { API } from "./helpers/api";
import { arrayToMap } from "../utils";
import { InvalidFractionalIndexError } from "../errors";
import { ExcalidrawElement } from "../element/types";
import { deepCopyElement } from "../element/newElement";
import { generateKeyBetween } from "fractional-indexing";

// TODO_FI:
// double-check those cases when it cannot generate an index (i.e. a2>a1)
// test that elements did not mutate on exception
// test that we don't cycle recursively during fallback (should be by default)
// avoid duplicates (we could always fallback)
// insert (and similar actions) could end up with incorrect sync - verify!
// come with more examples leading to incorrect indices between fallback + moved elements
// test that reorder is always from one direction (host app) compared to "moved elements"
// test reconcillitation (first restore creates indices)
// - if the elements are same, the indices will be the same (all good)
// - for completely different arrays of elements, the indices will again be the same and order wil "merge" them together (not ideal) - but will this happen anyway?
// - I have to make se all clients end up with same order regardless the items!
// should I think about some special cases with soft / hard deleted elements?

describe("sync invalid indices with array order", () => {
  describe("should not sync empty array", () => {
    testFractionalIndicesSync({
      elements: [],
      movedElements: [],
      expect: {
        unchangedElements: [],
        validInput: true,
      },
    });

    testFractionalIndicesSync({
      elements: [],
      expect: {
        unchangedElements: [],
        validInput: true,
      },
    });
  });

  describe("should not sync when index is well defined", () => {
    testFractionalIndicesSync({
      elements: [{ id: "A", index: "a1" }],
      movedElements: [],
      expect: {
        unchangedElements: ["A"],
        validInput: true,
      },
    });

    testFractionalIndicesSync({
      elements: [{ id: "A", index: "a1" }],
      expect: {
        unchangedElements: ["A"],
        validInput: true,
      },
    });
  });

  describe("should not sync when indices are well defined", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a2" },
        { id: "C", index: "a3" },
      ],
      movedElements: [],
      expect: {
        unchangedElements: ["A", "B", "C"],
        validInput: true,
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a2" },
        { id: "C", index: "a3" },
      ],
      expect: {
        unchangedElements: ["A", "B", "C"],
        validInput: true,
      },
    });
  });

  describe("should not sync already valid indices", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a0" },
        { id: "C", index: "a2" },
      ],
      movedElements: ["B", "C"],
      expect: {
        // should not sync "C", it's already on the top
        unchangedElements: ["A", "C"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a0" },
        { id: "C", index: "a2" },
      ],
      movedElements: ["A", "B"],
      expect: {
        // should not sync "A", it's already on the bottom
        unchangedElements: ["A", "C"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a0" },
        { id: "C", index: "a2" },
      ],
      expect: {
        unchangedElements: ["A", "C"],
      },
    });
  });

  describe("should sync when fractional index is not defined", () => {
    testFractionalIndicesSync({
      elements: [{ id: "A" }],
      movedElements: ["A"],
      expect: {
        unchangedElements: [],
      },
    });

    testFractionalIndicesSync({
      elements: [{ id: "A" }],
      expect: {
        unchangedElements: [],
      },
    });
  });

  describe("should sync when fractional indices are duplicated", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a1" },
      ],
      movedElements: ["B"],
      expect: {
        unchangedElements: ["A"],
      },
    });
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a1" },
      ],
      expect: {
        unchangedElements: ["A"],
      },
    });
  });

  describe("should sync when a fractional index is out of order", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a2" },
        { id: "B", index: "a1" },
      ],
      movedElements: ["B"],
      expect: {
        unchangedElements: ["A"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a2" },
        { id: "B", index: "a1" },
      ],
      expect: {
        unchangedElements: ["A"],
      },
    });
  });

  describe("should sync when fractional indices are out of order", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a3" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
      ],
      movedElements: ["B", "C"],
      expect: {
        unchangedElements: ["A"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a3" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
      ],
      expect: {
        unchangedElements: ["A"],
      },
    });
  });

  describe("should sync when incorrect fractional index is in between correct ones ", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a0" },
        { id: "C", index: "a2" },
      ],
      movedElements: ["B"],
      expect: {
        unchangedElements: ["A", "C"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a0" },
        { id: "C", index: "a2" },
      ],
      expect: {
        unchangedElements: ["A", "C"],
      },
    });
  });

  describe("should sync when incorrect fractional is on top and duplicated below", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
      ],
      movedElements: ["C"],
      expect: {
        unchangedElements: ["A", "B"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
      ],
      expect: {
        unchangedElements: ["A", "B"],
      },
    });
  });

  describe("should sync when given a mix of duplicate / invalid indices", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a0" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
        { id: "D", index: "a1" },
        { id: "E", index: "a2" },
      ],
      movedElements: ["C", "D", "E"],
      expect: {
        unchangedElements: ["A", "B"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a0" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
        { id: "D", index: "a1" },
        { id: "E", index: "a2" },
      ],
      expect: {
        unchangedElements: ["A", "B"],
      },
    });
  });

  describe("should sync when given a mix of undefined / invalid indices", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A" },
        { id: "B" },
        { id: "C", index: "a0" },
        { id: "D", index: "a2" },
        { id: "E" },
        { id: "F", index: "a3" },
        { id: "G" },
        { id: "H", index: "a1" },
        { id: "I", index: "a2" },
        { id: "J" },
      ],
      movedElements: ["A", "B", "E", "G", "H", "I", "J"],
      expect: {
        unchangedElements: ["C", "D", "F"],
      },
    });

    testFractionalIndicesSync({
      elements: [
        { id: "A" },
        { id: "B" },
        { id: "C", index: "a0" },
        { id: "D", index: "a2" },
        { id: "E" },
        { id: "F", index: "a3" },
        { id: "G" },
        { id: "H", index: "a1" },
        { id: "I", index: "a2" },
        { id: "J" },
      ],
      expect: {
        unchangedElements: ["C", "D", "F"],
      },
    });
  });

  describe("should generate fractions for explicitly moved elements", () => {
    describe("should generate a fraction between 'A' and 'C'", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          // doing actual fractions, without jitter 'a1' becomes 'a1V'
          // as V is taken as the middle-right value
          { id: "B", index: "a1" },
          { id: "C", index: "a2" },
        ],
        movedElements: ["B"],
        expect: {
          unchangedElements: ["A", "C"],
        },
      });

      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          { id: "B", index: "a1" },
          { id: "C", index: "a2" },
        ],
        expect: {
          // as above, B will become fractional
          unchangedElements: ["A", "C"],
        },
      });
    });

    describe("should generate fractions between 'A' and 'G'", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a01" },
          { id: "B", index: "a01" },
          { id: "C", index: "a01" },
          { id: "D", index: "a01" },
          { id: "E", index: "a02" },
          { id: "F", index: "a02" },
          { id: "G", index: "a02" },
        ],
        movedElements: ["B", "C", "D", "F", "G"],
        expect: {
          unchangedElements: ["A", "E"],
        },
      });

      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a01" },
          { id: "B", index: "a01" },
          { id: "C", index: "a01" },
          { id: "D", index: "a01" },
          { id: "E", index: "a02" },
          { id: "F", index: "a02" },
          { id: "G", index: "a02" },
        ],
        expect: {
          unchangedElements: ["A", "E"],
        },
      });
    });
  });

  describe("should be able to sync 20K invalid indices", () => {
    const length = 20_000;

    describe("should sync all empty indices", () => {
      const elements = Array.from({ length }).map((_, index) => ({
        id: `A_${index}`,
      }));

      testFractionalIndicesSync({
        // elements without fractional index
        elements,
        movedElements: Array.from({ length }).map((_, index) => `A_${index}`),
        expect: {
          unchangedElements: [],
        },
      });

      testFractionalIndicesSync({
        // elements without fractional index
        elements,
        expect: {
          unchangedElements: [],
        },
      });
    });

    describe("should sync all but last index given a growing array of indices", () => {
      let lastIndex: string | null = null;

      const elements = Array.from({ length }).map((_, index) => {
        // going up from 'a0'
        lastIndex = generateKeyBetween(lastIndex, null);

        return {
          id: `A_${index}`,
          // assigning only the last generated index, so sync can go down from there
          // without jitter lastIndex is 'c4BZ' for 20000th element
          index: index === length - 1 ? lastIndex : undefined,
        };
      });
      const movedElements = Array.from({ length }).map(
        (_, index) => `A_${index}`,
      );
      // remove last element
      movedElements.pop();

      testFractionalIndicesSync({
        elements,
        movedElements,
        expect: {
          unchangedElements: [`A_${length - 1}`],
        },
      });

      testFractionalIndicesSync({
        elements,
        expect: {
          unchangedElements: [`A_${length - 1}`],
        },
      });
    });

    describe("should sync all but first index given a declining array of indices", () => {
      let lastIndex: string | null = null;

      const elements = Array.from({ length }).map((_, index) => {
        // going down from 'a0'
        lastIndex = generateKeyBetween(null, lastIndex);

        return {
          id: `A_${index}`,
          // without jitter lastIndex is 'XvoR' for 20000th element
          index: lastIndex,
        };
      });
      const movedElements = Array.from({ length }).map(
        (_, index) => `A_${index}`,
      );
      // remove first element
      movedElements.shift();

      testFractionalIndicesSync({
        elements,
        movedElements,
        expect: {
          unchangedElements: [`A_0`],
        },
      });

      testFractionalIndicesSync({
        elements,
        expect: {
          unchangedElements: [`A_0`],
        },
      });
    });
  });

  describe("should automatically fallback to fixing all invalid indices given an invalid input", () => {
    describe("should fallback when moved element is in between unordered elements", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a2" },
          { id: "B" },
          { id: "C", index: "a1" },
        ],
        // 'B' is invalid, but so is 'C', which was for whatever reason not marked as moved
        // therefore the algo will try to generate a key between a2 and a1
        // which it cannot do, thus it will throw and lead to triggering fallback
        movedElements: ["B"],
        expect: {
          unchangedElements: ["A"],
        },
      });
    });

    describe("should fallback when unordered and undefined indices are in between", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a2" },
          { id: "B" },
          { id: "C" },
          { id: "D", index: "a1" },
          { id: "E", index: "a1" },
          { id: "F", index: "a1" },
          { id: "G" },
          { id: "I", index: "a3" },
          { id: "H" },
        ],
        // missed "E" which will fail the validation and automatically fallback
        movedElements: ["B", "C", "D", "F", "G", "H"],
        expect: {
          unchangedElements: ["A", "I"],
        },
      });
    });

    describe("should fallback when specified moved elements are invalid", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          { id: "B", index: "a1" },
        ],
        // 'A' is for our algo marked as moved, but it has a valid index
        // 'B' is invalid, but is not marked as moved
        // both of these conditions (marked & invalid) have to be satisfied in order to perform sync
        // in this case they are not, thus nothing will be synced and we will throw during validation
        // therefore the algo will fallback to fixing all invalid indices (regardless specified movedElements)
        movedElements: ["A"],
        expect: {
          unchangedElements: ["A"],
        },
      });
    });

    describe("should fallback when specified moved elements are empty", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          { id: "B", index: "a1" },
          { id: "C", index: "a1" },
        ],
        // similar to above, the validation will throw as nothing was synced
        // therefore it will lead to triggering the fallback and fixing all invalid indices
        movedElements: [],
        expect: {
          unchangedElements: ["A"],
        },
      });
    });

    describe("should fallback to syncing all invalid indices when no elements are moved", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          { id: "B" },
          { id: "C", index: "a0" },
        ],
        movedElements: [], // no explicitly moved elements
        expect: {
          // since elements are invalid, this will fail the validation
          // leading to fallback fixing "B" and "C"
          unchangedElements: ["A"],
        },
      });
    });

    describe("should fallback when valid elements are marked as moved", () => {
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a01" },
          { id: "B", index: "a01" },
          { id: "C", index: "a01" },
          { id: "D", index: "a01" },
          { id: "E", index: "a02" },
          { id: "F", index: "a02" },
          { id: "G", index: "a02" },
        ],
        // TODO_FI: actually we might not want to check for validity due to cases like this
        // 'E' is specified as moved but for algo to sync it, it has to be invalid
        // but with a01 as lower bound and 'undefined' as upper bound it is completely valid index
        // thus we will end up with 'E' & 'G' with same indices
        // though validation will detect this and fallback will fix it
        movedElements: ["B", "C", "D", "E", "F"],
        expect: {
          unchangedElements: ["A", "E"],
        },
      });
    });
  });
});

function testFractionalIndicesSync(args: {
  elements: { id: string; index?: string }[]; // TODO_FI: the index should be either undefined (boundaries) or well defined
  movedElements?: string[];
  expect: {
    unchangedElements: string[];
    validInput?: true;
  };
}) {
  const [elements, movedElements] = prepareArguments(
    args.elements,
    args.movedElements,
  );
  const expectUnchangedElements = arrayToMap(
    args.expect.unchangedElements.map((x) => ({ id: x })),
  );

  const name = movedElements
    ? "should sync invalid indices of moved elements or fallback to fixing invalid indices of all elements"
    : "should sync invalid indices of all elements";

  test(
    name,
    elements,
    movedElements,
    expectUnchangedElements,
    args.expect.validInput,
  );
}

function prepareArguments(
  elementsLike: { id: string; index?: string }[],
  movedElementsIds?: string[],
): [ExcalidrawElement[], Map<string, ExcalidrawElement> | undefined] {
  const elements = elementsLike.map((x) => API.createElement(x));
  const movedMap = arrayToMap(movedElementsIds || []);
  const movedElements = movedElementsIds
    ? arrayToMap(elements.filter((x) => movedMap.has(x.id)))
    : undefined;

  return [elements, movedElements];
}

function test(
  name: string,
  elements: ExcalidrawElement[],
  movedElements: Map<string, ExcalidrawElement> | undefined,
  expectUnchangedElements: Map<string, { id: string }>,
  expectValidInput?: boolean,
) {
  it(name, () => {
    // ensure the input is invalid (unless the flag is on)
    if (!expectValidInput) {
      expect(() =>
        validateFractionalIndices(elements.map((x) => x.index)),
      ).toThrowError(InvalidFractionalIndexError);
    }

    // clone due to mutation
    const clonedElements = elements.map((x) => deepCopyElement(x));

    // Act
    // TODO_FI: benchmark would be nice, but it looks like it cannot be in the same file
    const syncedElements = syncFractionalIndices(clonedElements, movedElements);

    expect(syncedElements.length).toBe(elements.length);
    expect(() =>
      validateFractionalIndices(syncedElements.map((x) => x.index)),
    ).not.toThrowError(InvalidFractionalIndexError);

    syncedElements.forEach((synced, index) => {
      const element = elements[index];
      // ensure the order hasn't changed
      expect(synced.id).toBe(element.id);

      // ensure the index didn't change if the the index was already valid
      if (expectUnchangedElements.has(synced.id)) {
        expect(synced.index).toBe(elements[index].index);
        expect(synced.version).toBe(elements[index].version);
      } else {
        expect(synced.index).not.toBe(elements[index].index);
        expect(synced.version).toBe(elements[index].version + 1);
      }
    });
  });
}
