/* eslint-disable no-lone-blocks */
import { generateKeyBetween } from "fractional-indexing";
import {
  syncFractionalIndices,
  ensureValidFractionalIndices,
} from "../fractionalIndex";
import { API } from "./helpers/api";
import { arrayToMap } from "../utils";
import { InvalidFractionalIndexError } from "../errors";
import { ExcalidrawElement } from "../element/types";

// TODO_FI:
// avoid duplicates (we could always fallback)
// test that reorder is always from one direction (host app) compared to "moved elements"
// test reconcillitation (first restore creates indices)
// - if the elements are same, the indices will be the same (all good)
// - for completely different arrays of elements, the indices will again be the same and order wil "merge" them together (not ideal) - but will this happen anyway?
// - I have to make se all clients end up with same order regardless the items!
// should I think about some special cases with soft / hard deleted elements?

describe("sync indices with array order", () => {
  describe("should not sync empty array", () =>
    testFractionalIndicesSync({
      elements: [],
      specified: {
        movedElements: [],
        expectUnchanged: [],
      },
      fallback: {
        expectUnchanged: [],
      },
      options: {
        expectValidInput: true,
      },
    }));

  describe("should not sync when indices are well defined", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a2" },
        { id: "C", index: "a3" },
      ],
      specified: {
        movedElements: [],
        expectUnchanged: ["A", "B", "C"],
      },
      fallback: {
        expectUnchanged: ["A", "B", "C"],
      },
      options: {
        expectValidInput: true,
      },
    });
  });

  describe("should sync when fractional indices are not defined", () => {
    testFractionalIndicesSync({
      elements: [{ id: "A" }],
      specified: {
        movedElements: ["A"],
        expectUnchanged: [],
      },
      fallback: {
        expectUnchanged: [],
      },
    });
  });

  describe("should sync when fractional indices are duplicated", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a1" },
      ],
      specified: {
        movedElements: ["B"],
        expectUnchanged: ["A"],
      },
      fallback: {
        expectUnchanged: ["A"],
      },
    });
  });

  describe("should sync when a fractional index is out of order", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a2" },
        { id: "B", index: "a1" },
      ],
      specified: {
        movedElements: ["B"],
        expectUnchanged: ["A"],
      },
      fallback: {
        expectUnchanged: ["A"],
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
      specified: {
        movedElements: ["B", "C"],
        expectUnchanged: ["A"],
      },
      fallback: {
        expectUnchanged: ["A"],
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
      specified: {
        movedElements: ["B"],
        expectUnchanged: ["A", "C"],
      },
      fallback: {
        expectUnchanged: ["A", "C"],
      },
    });
  });

  describe("should sync when incorrect fractional is on top", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a1" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
      ],
      specified: {
        movedElements: ["C"],
        expectUnchanged: ["A", "B"],
      },
      fallback: {
        expectUnchanged: ["A", "B"],
      },
    });
  });

  describe("should sync when given a mix of duplicate / invalid ones", () => {
    testFractionalIndicesSync({
      elements: [
        { id: "A", index: "a0" },
        { id: "B", index: "a2" },
        { id: "C", index: "a1" },
        { id: "D", index: "a1" },
        { id: "E", index: "a2" },
      ],
      specified: {
        movedElements: ["B", "C", "D", "E"],
        expectUnchanged: ["A"],
      },
      fallback: {
        expectUnchanged: ["A"],
      },
    });
  });

  describe("should sync only invalid indices given a mix of undefined / invalid ones", () => {
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
      specified: {
        movedElements: ["A", "B", "E", "G", "H", "I", "J"],
        expectUnchanged: ["C", "D", "F"],
      },
      fallback: {
        expectUnchanged: ["C", "D", "F"],
      },
    });
  });

  describe("should not sync other than explicitly moved elements", () => {
    describe("should not sync when no elements are moved", () =>
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          { id: "B" },
          { id: "C", index: "a0" },
        ],
        specified: {
          movedElements: [], // no explicitly moved elements
          expectUnchanged: ["A", "B", "C"],
          expectInvalidOutput: true, // input is unchanged
        },
        fallback: {
          expectUnchanged: ["A"],
        },
      }));

    describe("should sync only one element even though others are invalid", () =>
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a5" },
          { id: "B", index: "a4" },
          { id: "C", index: "a3" },
        ],
        specified: {
          movedElements: ["C"],
          expectUnchanged: ["A", "B"], // A, B were not moved, so they are not being changed
          expectInvalidOutput: true,
        },
        fallback: {
          expectUnchanged: ["A"],
        },
      }));

    describe("should generate a fraction between 'A' and 'C'", () =>
      testFractionalIndicesSync({
        elements: [
          { id: "A", index: "a1" },
          // doing actual fractions, without jitter 'a1' becomes 'a1V'
          // as V is taken as the middle-right value
          { id: "B", index: "a1" },
          { id: "C", index: "a2" },
        ],
        specified: {
          movedElements: ["B"],
          expectUnchanged: ["A", "C"],
        },
        fallback: {
          expectUnchanged: ["A", "C"],
        },
      }));

    describe("should generate fractions between 'A' and 'G'", () =>
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
        specified: {
          movedElements: ["B", "C", "D", "E", "F"],
          expectUnchanged: ["A", "G"],
        },
        fallback: {
          expectUnchanged: ["A", "E"],
        },
      }));
  });

  describe("should be able to sync 20K invalid indices", () => {
    const length = 20_000;

    describe("should sync all elements with empty indices", () =>
      testFractionalIndicesSync({
        // elements without fractional index
        elements: Array.from({ length }).map((_, index) => ({
          id: `A_${index}`,
        })),
        specified: {
          movedElements: Array.from({ length }).map((_, index) => `A_${index}`),
          expectUnchanged: [],
        },
        fallback: {
          expectUnchanged: [],
        },
      }));

    describe("should sync all but first element (going up)", () => {
      let lastIndex: string | null = null;

      const movedElements = Array.from({ length }).map(
        (_, index) => `A_${index}`,
      );
      // remove first element
      movedElements.shift();

      testFractionalIndicesSync({
        elements: Array.from({ length }).map((_, index) => {
          // going down from 'a0'
          lastIndex = generateKeyBetween(null, lastIndex);

          return {
            id: `A_${index}`,
            // without jitter lastIndex is 'XvoR' for 20000th element
            index: lastIndex,
          };
        }),
        specified: {
          movedElements,
          expectUnchanged: [`A_0`],
        },
        fallback: {
          expectUnchanged: [`A_0`],
        },
      });
    });

    describe("should sync all but last element (going down)", () => {
      let lastIndex: string | null = null;

      const movedElements = Array.from({ length }).map(
        (_, index) => `A_${index}`,
      );
      // remove last element
      movedElements.pop();

      testFractionalIndicesSync({
        elements: Array.from({ length }).map((_, index) => {
          // going up from 'a0'
          lastIndex = generateKeyBetween(lastIndex, null);

          return {
            id: `A_${index}`,
            // assigning only the last generated index, so sync can go down from there
            // without jitter lastIndex is 'c4BZ' for 20000th element
            index: index === length - 1 ? lastIndex : undefined,
          };
        }),
        specified: {
          movedElements,
          expectUnchanged: [`A_${length - 1}`],
        },
        fallback: {
          expectUnchanged: [`A_${length - 1}`],
        },
      });
    });
  });
});

/**
 *
 */
function testFractionalIndicesSync({
  elements,
  specified,
  fallback,
  options,
}: {
  elements: { id: string; index?: string }[]; // TODO_FI: the index should be either undefined (boundaries) or well defined
  specified?: {
    movedElements: string[];
    expectUnchanged: string[];
    expectInvalidOutput?: boolean;
  };
  fallback?: {
    expectUnchanged: string[];
  };
  options?: {
    expectValidInput?: boolean;
  };
}) {
  if (specified) {
    const [unsyncedElements, movedElements] = prepareArguments(
      specified.movedElements,
    );
    const expectUnchanged = arrayToMap(
      specified.expectUnchanged.map((x) => ({ id: x })),
    );
    test(
      "should sync only specified moved elements #specified",
      unsyncedElements,
      movedElements,
      expectUnchanged,
      specified.expectInvalidOutput,
    );
  }

  if (fallback) {
    const expectUnchangedWithoutMoved = arrayToMap(
      fallback.expectUnchanged.map((x) => ({ id: x })),
    );
    const [unsyncedElements] = prepareArguments();
    test(
      "should sync all invalid indices #fallback",
      unsyncedElements,
      undefined,
      expectUnchangedWithoutMoved,
    );
  }

  function test(
    name: string,
    unsyncedElements: ExcalidrawElement[],
    movedElements: Map<string, ExcalidrawElement> | undefined,
    expectUnchanged: Map<string, { id: string }>,
    expectInvalidOutput?: boolean,
  ) {
    it(name, () => {
      // Ensure the input is invalid (unless the flag is on)
      if (!options?.expectValidInput) {
        expect(() =>
          ensureValidFractionalIndices(unsyncedElements),
        ).toThrowError(InvalidFractionalIndexError);
      }

      // TODO_FI: benchmark would be nice, but it looks like it cannot be in the same file
      // Act
      const syncedElements = syncFractionalIndices(
        unsyncedElements,
        movedElements,
      );

      expect(syncedElements.length).toBe(elements.length);

      if (expectInvalidOutput) {
        expect(() => ensureValidFractionalIndices(syncedElements)).toThrowError(
          InvalidFractionalIndexError,
        );
      } else {
        expect(() =>
          ensureValidFractionalIndices(syncedElements),
        ).not.toThrowError(InvalidFractionalIndexError);
      }

      syncedElements.forEach((synced, index) => {
        const unsynced = elements[index];
        // Ensure the order hasn't changed
        expect(synced.id).toBe(unsynced.id);

        // Ensure the index didn't change if the the index was already valid
        if (expectUnchanged.has(synced.id)) {
          expect(synced.index).toBe(elements[index].index);
        } else {
          expect(synced.index).not.toBe(elements[index].index);
        }
      });
    });
  }

  function prepareArguments(
    moved?: string[],
  ): [Array<ExcalidrawElement>, Map<string, ExcalidrawElement> | undefined] {
    const unsyncedElements = elements.map((x) => API.createElement(x));
    const movedMap = arrayToMap(moved || []);
    const movedElements = moved
      ? arrayToMap(unsyncedElements.filter((x) => movedMap.has(x.id)))
      : undefined;

    return [unsyncedElements, movedElements];
  }
}
