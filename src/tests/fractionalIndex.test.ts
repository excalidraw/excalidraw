import { nanoid } from "nanoid";
import {
  restoreFractionalIndicies,
  validateFractionalIndicies,
} from "../fractionalIndex";
import { ExcalidrawElement } from "../element/types";
import { API } from "./helpers/api";

const createElementWithIndex = (
  fractionalIndex: string | null = null,
): ExcalidrawElement => {
  return API.createElement({
    type: "rectangle",
    fractionalIndex,
  });
};

describe("restoring fractional indicies", () => {
  it("restore all null fractional indices", () => {
    const randomNumOfElements = Math.floor(Math.random() * 100);

    const elements: ExcalidrawElement[] = [];

    let i = 0;

    while (i < randomNumOfElements) {
      elements.push(createElementWithIndex());
      i++;
    }

    const restoredElements = restoreFractionalIndicies(elements);

    // length is not changed
    expect(restoredElements.length).toBe(randomNumOfElements);
    // order is not changed
    expect(restoredElements.map((e) => e.id)).deep.equal(
      elements.map((e) => e.id),
    );
    // fractional indices are valid
    expect(validateFractionalIndicies(restoredElements)).toBe(true);
  });

  it("restore out of order fractional indices", () => {
    const elements = [
      createElementWithIndex("a0"),
      createElementWithIndex("c0"),
      createElementWithIndex("b0"),
      createElementWithIndex("d0"),
    ];

    const restoredElements = restoreFractionalIndicies(elements);

    // length is not changed
    expect(restoredElements.length).toBe(4);
    // order is not changed
    expect(restoredElements.map((e) => e.id)).deep.equal(
      elements.map((e) => e.id),
    );
    // fractional indices are valid
    expect(validateFractionalIndicies(restoredElements)).toBe(true);
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
      elements.push(createElementWithIndex("a0"));
      i++;
    }

    const restoredElements = restoreFractionalIndicies(elements);

    // length is not changed
    expect(restoredElements.length).toBe(randomNumOfElements);
    // order is not changed
    expect(restoredElements.map((e) => e.id)).deep.equal(
      elements.map((e) => e.id),
    );
    // should've restored fractional indices properly
    expect(validateFractionalIndicies(restoredElements)).toBe(true);
    expect(new Set(restoredElements.map((e) => e.fractionalIndex)).size).toBe(
      randomNumOfElements,
    );
  });
});
