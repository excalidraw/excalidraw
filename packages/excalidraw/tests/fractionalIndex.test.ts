import {
  fixFractionalIndices,
  generateKeyBetween,
  restoreFractionalIndices,
  validateFractionalIndices,
} from "../fractionalIndex";
import { ExcalidrawElement } from "../element/types";
import { API } from "./helpers/api";
import { arrayToMap } from "../utils";
import { moveAllLeft, moveOneLeft, moveOneRight } from "../zindex";
import { AppState } from "../types";

const createElementWithIndex = (
  fractionalIndex: string | null = null,
): ExcalidrawElement => {
  return API.createElement({
    type: "rectangle",
    fractionalIndex,
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
  expect(validateFractionalIndices(elements)).toBe(true);
};

const generateElementsAtLength = (length: number) => {
  const elements: ExcalidrawElement[] = [];

  for (let i = 0; i < length; i++) {
    elements.push(createElementWithIndex());
  }

  return elements;
};

describe("restoring fractional indices", () => {
  it("restore all null fractional indices", () => {
    const randomNumOfElements = Math.floor(Math.random() * 100);

    const elements: ExcalidrawElement[] = [];

    let i = 0;

    while (i < randomNumOfElements) {
      elements.push(createElementWithIndex());
      i++;
    }

    const restoredElements = restoreFractionalIndices(elements);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
  });

  it("restore out of order fractional indices", () => {
    const elements = [
      createElementWithIndex("A0"),
      createElementWithIndex("C0"),
      createElementWithIndex("B0"),
      createElementWithIndex("D0"),
    ];

    const restoredElements = restoreFractionalIndices(elements);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
    // should only fix the second element's fractional index
    expect(elements[1].fractionalIndex).not.toEqual(
      restoredElements[1].fractionalIndex,
    );
    expect(elements.filter((value, index) => index !== 1)).deep.equal(
      restoredElements.filter((value, index) => index !== 1),
    );
  });

  it("restore same fractional indices", () => {
    const randomNumOfElements = Math.floor(Math.random() * 100);

    const elements: ExcalidrawElement[] = [];

    let i = 0;

    while (i < randomNumOfElements) {
      elements.push(createElementWithIndex(generateKeyBetween(null, null)));
      i++;
    }

    const restoredElements = restoreFractionalIndices(elements);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
    expect(new Set(restoredElements.map((e) => e.fractionalIndex)).size).toBe(
      randomNumOfElements,
    );
  });

  it("restore a mix of bad fractional indices", () => {
    const elements = [
      createElementWithIndex("A0"),
      createElementWithIndex("A0"),
      createElementWithIndex("A1"),
      createElementWithIndex(),
      createElementWithIndex("A3"),
      createElementWithIndex("A2"),
      createElementWithIndex(),
      createElementWithIndex(),
    ];

    const restoredElements = restoreFractionalIndices(elements);

    testLengthAndOrder(elements, restoredElements);
    testValidity(restoredElements);
    expect(new Set(restoredElements.map((e) => e.fractionalIndex)).size).toBe(
      elements.length,
    );
  });
});

describe("fix fractional indices", () => {
  it("add each new element properly", () => {
    const elements = [
      createElementWithIndex(),
      createElementWithIndex(),
      createElementWithIndex(),
      createElementWithIndex(),
    ];

    const fixedElements = elements.reduce((acc, el) => {
      return fixFractionalIndices([...acc, el], arrayToMap([el]));
    }, [] as ExcalidrawElement[]);

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);
  });

  it("add each new element properly - long", () => {
    const elements = generateElementsAtLength(20000);

    const fixedElements = elements.reduce((acc, el) => {
      return fixFractionalIndices([...acc, el], arrayToMap([el]));
    }, [] as ExcalidrawElement[]);

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);
  });

  it("add multiple new elements properly", () => {
    const elements = generateElementsAtLength(Math.floor(Math.random() * 100));

    const fixedElements = fixFractionalIndices(elements, arrayToMap(elements));

    testLengthAndOrder(elements, fixedElements);
    testValidity(fixedElements);

    const elements2 = generateElementsAtLength(Math.floor(Math.random() * 100));

    const allElements2 = [...elements, ...elements2];

    const fixedElements2 = fixFractionalIndices(
      allElements2,
      arrayToMap(elements2),
    );

    testLengthAndOrder(allElements2, fixedElements2);
    testValidity(fixedElements2);
  });

  it("fix properly after z-index changes", () => {
    const elements = generateElementsAtLength(Math.random() * 100);

    const fixedElements = fixFractionalIndices(elements, arrayToMap(elements));

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
});
