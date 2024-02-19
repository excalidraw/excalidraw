import {
  generateKeyBetween,
  restoreFractionalIndices,
  updateFractionalIndices,
  validateFractionalIndices,
} from "../fractionalIndex";
import { ExcalidrawElement } from "../element/types";
import { API } from "./helpers/api";
import { arrayToMap } from "../utils";
import { moveAllLeft, moveOneLeft, moveOneRight } from "../zindex";
import { AppState } from "../types";
import { InvalidFractionalIndexError } from "../errors";

const createElement = (
  fractionalIndex: string | null = null,
): ExcalidrawElement => {
  return API.createElement({
    type: "rectangle",
    index: fractionalIndex,
  });
};

const testLengthAndOrder = (
  before: ExcalidrawElement[],
  after: ExcalidrawElement[],
) => {
  // length is not changed
  expect(after.length).toBe(before.length);
  // order is not changed
  expect(after.map((e) => e.id)).deep.equal(before.map((e) => e.id));
};

const testValidity = (elements: ExcalidrawElement[]) => {
  expect(() => validateFractionalIndices(elements)).not.toThrowError(
    InvalidFractionalIndexError,
  );
};

const generateElementsAtLength = (length: number) => {
  const elements: ExcalidrawElement[] = [];

  for (let i = 0; i < length; i++) {
    elements.push(createElement());
  }

  return elements;
};

describe("validating fractional indices", () => {
  it("should not pass validity check when elements are not in order", () => {
    const elements = [createElement("A1"), createElement("A0")];

    expect(() => validateFractionalIndices(elements)).toThrowError(
      InvalidFractionalIndexError,
    );
  });

  it("should not pass validity check when elements have equal indices", () => {
    const elements = [createElement("A0"), createElement("A0")];

    expect(() => validateFractionalIndices(elements)).toThrowError(
      InvalidFractionalIndexError,
    );
  });
});

describe("restoring fractional indices", () => {
  it("should restore all null fractional indices", () => {
    const randomNumOfElements = Math.floor(Math.random() * 100);

    const elements: ExcalidrawElement[] = [];

    let i = 0;

    while (i < randomNumOfElements) {
      elements.push(createElement());
      i++;
    }

    const restoredElements = restoreFractionalIndices([...elements]);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
  });

  it("should restore out of order fractional indices", () => {
    const elements = [
      createElement("A0"),
      createElement("C0"),
      createElement("B0"),
      createElement("D0"),
    ];

    const restoredElements = restoreFractionalIndices([...elements]);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
    // should only fix the second element's fractional index
    expect(elements[1].index).not.toEqual("C0");
    expect(elements.filter((value, index) => index !== 1)).deep.equal(
      restoredElements.filter((value, index) => index !== 1),
    );
  });

  it("should restore same fractional indices", () => {
    const randomNumOfElements = Math.floor(Math.random() * 100);

    const elements: ExcalidrawElement[] = [];

    let i = 0;

    while (i < randomNumOfElements) {
      elements.push(createElement(generateKeyBetween(null, null)));
      i++;
    }

    const restoredElements = restoreFractionalIndices([...elements]);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
    expect(new Set(restoredElements.map((e) => e.index)).size).toBe(
      randomNumOfElements,
    );
  });

  it("should restore a mix of bad fractional indices", () => {
    const elements = [
      createElement("A0"),
      createElement("A0"),
      createElement("A1"),
      createElement(),
      createElement("A3"),
      createElement("A2"),
      createElement(),
      createElement(),
    ];

    const restoredElements = restoreFractionalIndices([...elements]);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
    expect(new Set(restoredElements.map((e) => e.index)).size).toBe(
      elements.length,
    );
  });
});

describe("update fractional indices", () => {
  it("should add index on few newly created elements", () => {
    const elements = [
      createElement(),
      createElement(),
      createElement(),
      createElement(),
    ];

    const fixedElements = elements.reduce((acc, el) => {
      return updateFractionalIndices([], [...acc, el], arrayToMap([el]));
    }, [] as ExcalidrawElement[]);

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);
  });

  it("should add index on a ton of newly created elements", () => {
    const elements = generateElementsAtLength(20000);

    const fixedElements = elements.reduce((acc, el) => {
      return updateFractionalIndices([], [...acc, el], arrayToMap([el]));
    }, [] as ExcalidrawElement[]);

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);
  });

  it("should add index only on newly created elements", () => {
    const elements = generateElementsAtLength(Math.floor(Math.random() * 100));
    const fixedElements = updateFractionalIndices(
      [],
      [...elements],
      arrayToMap(elements),
    );

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);

    const elements2 = generateElementsAtLength(Math.floor(Math.random() * 100));
    const allElements2 = [...elements, ...elements2];
    const fixedElements2 = updateFractionalIndices(
      [...elements],
      [...allElements2],
      arrayToMap(elements2),
    );

    testLengthAndOrder(allElements2, fixedElements2);
    testValidity(fixedElements2);
  });

  it("should update index after z-index changes", () => {
    const elements = generateElementsAtLength(Math.random() * 100);
    const fixedElements = updateFractionalIndices(
      [],
      [...elements],
      arrayToMap(elements),
    );

    let randomlySelected = [
      ...new Set([
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
        fixedElements[Math.floor(Math.random() * fixedElements.length)],
      ]),
    ];

    const movedOneLeftFixedElements = moveOneLeft(
      fixedElements,
      randomlySelected.reduce(
        (acc, el) => {
          acc.selectedElementIds[el.id] = true;
          return acc;
        },
        {
          selectedElementIds: {},
        } as {
          selectedElementIds: Record<string, boolean>;
        },
      ) as any as AppState,
    );

    testValidity(movedOneLeftFixedElements);

    randomlySelected = [
      ...new Set([
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
      ]),
    ];

    const movedOneRightFixedElements = moveOneRight(
      movedOneLeftFixedElements,
      randomlySelected.reduce(
        (acc, el) => {
          acc.selectedElementIds[el.id] = true;
          return acc;
        },
        {
          selectedElementIds: {},
        } as {
          selectedElementIds: Record<string, boolean>;
        },
      ) as any as AppState,
    );

    testValidity(movedOneRightFixedElements);

    randomlySelected = [
      ...new Set([
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedOneRightFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
      ]),
    ];

    const movedAllLeftFixedElements = moveAllLeft(
      movedOneRightFixedElements,
      randomlySelected.reduce(
        (acc, el) => {
          acc.selectedElementIds[el.id] = true;
          return acc;
        },
        {
          selectedElementIds: {},
        } as {
          selectedElementIds: Record<string, boolean>;
        },
      ) as any as AppState,
    ) as ExcalidrawElement[];

    testValidity(movedAllLeftFixedElements);

    randomlySelected = [
      ...new Set([
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
        movedAllLeftFixedElements[
          Math.floor(Math.random() * fixedElements.length)
        ],
      ]),
    ];

    const movedAllRightFixedElements = moveAllLeft(
      movedAllLeftFixedElements,
      randomlySelected.reduce(
        (acc, el) => {
          acc.selectedElementIds[el.id] = true;
          return acc;
        },
        {
          selectedElementIds: {},
        } as {
          selectedElementIds: Record<string, boolean>;
        },
      ) as any as AppState,
    ) as ExcalidrawElement[];

    testValidity(movedAllRightFixedElements);
  });

  /**
   * One of the cases is that often the first element could be brought further up by the user, even though it's already on top (and vice versa the last one).
   * In those cases we don't want to regenerate the index, as the action does not result in a visible change.
   */
  it("should not update already valid index", () => {
    const elements = [
      createElement("A0a"),
      createElement("A0b"),
      createElement("A0c"),
      createElement("A0d"),
    ];

    const firstElement = elements[0];
    const lastElement = elements.at(-1)!;
    const firstElementIndex = firstElement.index;
    const lastElementIndex = lastElement.index;

    const fixedElements = updateFractionalIndices(
      elements,
      elements,
      arrayToMap([firstElement, lastElement]),
    );

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);

    expect(firstElementIndex).toBe(firstElement.index);
    expect(lastElementIndex).toBe(lastElement.index);
  });
});
