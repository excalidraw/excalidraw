import React from "react";

import { CODES } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard } from "../tests/helpers/ui";
import { render } from "../tests/test-utils";

const { h } = window;

const getElement = (id: string) => h.elements.find((el) => el.id === id)!;

const centerX = (id: string) => {
  const element = getElement(id);
  return element.x + element.width / 2;
};

const centerY = (id: string) => {
  const element = getElement(id);
  return element.y + element.height / 2;
};

describe("align & distribute keyboard shortcuts", () => {
  let elements: ReturnType<typeof API.createElement>[];

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    elements = [
      API.createElement({
        type: "rectangle",
        id: "A",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      }),
      API.createElement({
        type: "rectangle",
        id: "B",
        x: 200,
        y: 100,
        width: 60,
        height: 200,
      }),
      API.createElement({
        type: "rectangle",
        id: "C",
        x: 400,
        y: 500,
        width: 40,
        height: 40,
      }),
    ];
    API.setElements(elements);
    API.setSelectedElements(elements);
  });

  it("centers the selection horizontally with Alt+Shift+H", () => {
    Keyboard.withModifierKeys({ alt: true, shift: true }, () => {
      Keyboard.codeDown(CODES.H);
    });

    expect(centerX("A")).toBe(220);
    expect(centerX("B")).toBe(220);
    expect(centerX("C")).toBe(220);
    // vertical positions are untouched
    expect(centerY("A")).toBe(25);
    expect(centerY("B")).toBe(200);
    expect(centerY("C")).toBe(520);
  });

  it("centers the selection vertically with Alt+Shift+V", () => {
    Keyboard.withModifierKeys({ alt: true, shift: true }, () => {
      Keyboard.codeDown(CODES.V);
    });

    expect(centerY("A")).toBe(270);
    expect(centerY("B")).toBe(270);
    expect(centerY("C")).toBe(270);
    // horizontal positions are untouched
    expect(centerX("A")).toBe(50);
    expect(centerX("B")).toBe(230);
    expect(centerX("C")).toBe(420);
  });

  it("does not center when only a single element is selected", () => {
    API.setSelectedElements([elements[1]]);

    Keyboard.withModifierKeys({ alt: true, shift: true }, () => {
      Keyboard.codeDown(CODES.H);
      Keyboard.codeDown(CODES.V);
    });

    expect(h.elements.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [200, 100],
      [400, 500],
    ]);
  });

  it("keeps Alt+H distributing horizontally", () => {
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.codeDown(CODES.H);
    });

    expect(getElement("B").x).toBe(220);
    expect(centerX("A")).toBe(50);
    expect(centerX("C")).toBe(420);
  });

  it("keeps Shift+H flipping horizontally", () => {
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.codeDown(CODES.H);
    });

    expect(getElement("A").x).toBe(340);
    expect(getElement("C").x).toBe(0);
  });
});
