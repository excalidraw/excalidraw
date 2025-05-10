import { degreesToRadians, pointFrom, pointRotateRads } from "@excalidraw/math";
import { act, fireEvent, queryByTestId } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

import { setDateTimeForTests, reseed } from "@excalidraw/common";

import { isInGroup } from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import type { Degrees } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw, getCommonBounds } from "../..";
import { actionGroup } from "../../actions";
import { t } from "../../i18n";
import * as StaticScene from "../../renderer/staticScene";
import { API } from "../../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../../tests/helpers/ui";
import { getTextEditor, updateTextEditor } from "../../tests/queries/dom";
import {
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../tests/test-utils";

import { getStepSizedValue } from "./utils";

const { h } = window;
const mouse = new Pointer("mouse");
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
let stats: HTMLElement | null = null;
let elementStats: HTMLElement | null | undefined = null;

const testInputProperty = (
  element: ExcalidrawElement,
  property: "x" | "y" | "width" | "height" | "angle" | "fontSize",
  label: string,
  initialValue: number,
  nextValue: number,
) => {
  const input = UI.queryStatsProperty(label)?.querySelector(
    ".drag-input",
  ) as HTMLInputElement;
  expect(input).toBeDefined();
  expect(input.value).toBe(initialValue.toString());
  UI.updateInput(input, String(nextValue));
  if (property === "angle") {
    expect(element[property]).toBe(
      degreesToRadians(Number(nextValue) as Degrees),
    );
  } else if (property === "fontSize" && isTextElement(element)) {
    expect(element[property]).toBe(Number(nextValue));
  } else if (property !== "fontSize") {
    expect(element[property]).toBe(Number(nextValue));
  }
};

describe("step sized value", () => {
  it("should return edge values correctly", () => {
    const steps = [10, 15, 20, 25, 30];
    const values = [10, 15, 20, 25, 30];

    steps.forEach((step, idx) => {
      expect(getStepSizedValue(values[idx], step)).toEqual(values[idx]);
    });
  });

  it("step sized value lies in the middle", () => {
    let stepSize = 15;
    let values = [7.5, 9, 12, 14.99, 15, 22.49];

    values.forEach((value) => {
      expect(getStepSizedValue(value, stepSize)).toEqual(15);
    });

    stepSize = 10;
    values = [-5, 4.99, 0, 1.23];
    values.forEach((value) => {
      expect(getStepSizedValue(value, stepSize)).toEqual(0);
    });
  });
});

describe("binding with linear elements", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(19);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    UI.clickTool("arrow");
    mouse.down(5, 0);
    mouse.up(300, 50);

    elementStats = stats?.querySelector("#elementStats");
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should remain bound to linear element on small position change", async () => {
    const linear = h.elements[1] as ExcalidrawLinearElement;
    const inputX = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(linear.startBinding).not.toBe(null);
    expect(inputX).not.toBeNull();
    UI.updateInput(inputX, String("204"));
    expect(linear.startBinding).not.toBe(null);
  });

  it("should remain bound to linear element on small angle change", async () => {
    const linear = h.elements[1] as ExcalidrawLinearElement;
    const inputAngle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(linear.startBinding).not.toBe(null);
    UI.updateInput(inputAngle, String("1"));
    expect(linear.startBinding).not.toBe(null);
  });

  it("should unbind linear element on large position change", async () => {
    const linear = h.elements[1] as ExcalidrawLinearElement;
    const inputX = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(linear.startBinding).not.toBe(null);
    expect(inputX).not.toBeNull();
    UI.updateInput(inputX, String("254"));
    expect(linear.startBinding).toBe(null);
  });

  it("should remain bound to linear element on small angle change", async () => {
    const linear = h.elements[1] as ExcalidrawLinearElement;
    const inputAngle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(linear.startBinding).not.toBe(null);
    UI.updateInput(inputAngle, String("45"));
    expect(linear.startBinding).toBe(null);
  });
});

// single element
describe("stats for a generic element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);
    elementStats = stats?.querySelector("#elementStats");
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should open stats", () => {
    expect(stats).toBeDefined();
    expect(elementStats).toBeDefined();

    // title
    const title = elementStats?.querySelector("h3");
    expect(title?.lastChild?.nodeValue)?.toBe(t("stats.elementProperties"));

    // element type
    const elementType = queryByTestId(elementStats!, "stats-element-type");
    expect(elementType).toBeDefined();
    expect(elementType?.lastChild?.nodeValue).toBe(t("element.rectangle"));

    // properties
    ["X", "Y", "W", "H", "A"].forEach((label) => () => {
      expect(
        stats!.querySelector?.(`.drag-input-container[data-testid="${label}"]`),
      ).toBeDefined();
    });
  });

  it("should be able to edit all properties for a general element", () => {
    const rectangle = h.elements[0];
    const initialX = rectangle.x;
    const initialY = rectangle.y;

    testInputProperty(rectangle, "width", "W", 200, 100);
    testInputProperty(rectangle, "height", "H", 100, 200);
    testInputProperty(rectangle, "x", "X", initialX, 230);
    testInputProperty(rectangle, "y", "Y", initialY, 220);
    testInputProperty(rectangle, "angle", "A", 0, 45);
  });

  it("should keep only two decimal places", () => {
    const rectangle = h.elements[0];
    const rectangleId = rectangle.id;

    const input = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe(rectangle.width.toString());
    UI.updateInput(input, "123.123");
    expect(h.elements.length).toBe(1);
    expect(rectangle.id).toBe(rectangleId);
    expect(input.value).toBe("123.12");
    expect(rectangle.width).toBe(123.12);

    UI.updateInput(input, "88.98766");
    expect(input.value).toBe("88.99");
    expect(rectangle.width).toBe(88.99);
  });

  it("should update input x and y when angle is changed", () => {
    const rectangle = h.elements[0];
    const [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );

    const xInput = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    const yInput = UI.queryStatsProperty("Y")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(xInput.value).toBe(topLeftX.toString());
    expect(yInput.value).toBe(topLeftY.toString());

    testInputProperty(rectangle, "angle", "A", 0, 45);

    let [newTopLeftX, newTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );

    expect(newTopLeftX.toString()).not.toEqual(xInput.value);
    expect(newTopLeftY.toString()).not.toEqual(yInput.value);

    testInputProperty(rectangle, "angle", "A", 45, 66);

    [newTopLeftX, newTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );
    expect(newTopLeftX.toString()).not.toEqual(xInput.value);
    expect(newTopLeftY.toString()).not.toEqual(yInput.value);
  });

  it("should fix top left corner when width or height is changed", () => {
    const rectangle = h.elements[0];

    testInputProperty(rectangle, "angle", "A", 0, 45);
    let [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );
    testInputProperty(rectangle, "width", "W", rectangle.width, 400);
    [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    let [currentTopLeftX, currentTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );
    expect(currentTopLeftX).toBeCloseTo(topLeftX, 4);
    expect(currentTopLeftY).toBeCloseTo(topLeftY, 4);

    testInputProperty(rectangle, "height", "H", rectangle.height, 400);
    [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    [currentTopLeftX, currentTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );

    expect(currentTopLeftX).toBeCloseTo(topLeftX, 4);
    expect(currentTopLeftY).toBeCloseTo(topLeftY, 4);
  });
});

describe("stats for a non-generic element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("text element", async () => {
    UI.clickTool("text");
    mouse.clickAt(20, 30);
    const textEditorSelector = ".excalidraw-textEditorContainer > textarea";
    const editor = await getTextEditor(textEditorSelector, true);
    updateTextEditor(editor, "Hello!");
    act(() => {
      editor.blur();
    });

    const text = h.elements[0] as ExcalidrawTextElement;
    mouse.clickOn(text);

    elementStats = stats?.querySelector("#elementStats");

    // can change font size
    const input = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe(text.fontSize.toString());
    UI.updateInput(input, "36");
    expect(text.fontSize).toBe(36);

    // cannot change width or height
    const width = UI.queryStatsProperty("W")?.querySelector(".drag-input");
    expect(width).toBeUndefined();
    const height = UI.queryStatsProperty("H")?.querySelector(".drag-input");
    expect(height).toBeUndefined();

    // min font size is 4
    UI.updateInput(input, "0");
    expect(text.fontSize).not.toBe(0);
    expect(text.fontSize).toBe(4);
  });

  it("frame element", () => {
    const frame = API.createElement({
      id: "id0",
      type: "frame",
      x: 150,
      width: 150,
    });
    API.setElements([frame]);
    API.setAppState({
      selectedElementIds: {
        [frame.id]: true,
      },
    });

    elementStats = stats?.querySelector("#elementStats");

    expect(elementStats).toBeDefined();

    // cannot change angle
    const angle = UI.queryStatsProperty("A")?.querySelector(".drag-input");
    expect(angle).toBeUndefined();

    // can change width or height
    testInputProperty(frame, "width", "W", frame.width, 250);
    testInputProperty(frame, "height", "H", frame.height, 500);
  });

  it("image element", () => {
    const image = API.createElement({ type: "image", width: 200, height: 100 });
    API.setElements([image]);
    mouse.clickOn(image);
    API.setAppState({
      selectedElementIds: {
        [image.id]: true,
      },
    });
    elementStats = stats?.querySelector("#elementStats");
    expect(elementStats).toBeDefined();
    const widthToHeight = image.width / image.height;

    // when width or height is changed, the aspect ratio is preserved
    testInputProperty(image, "width", "W", image.width, 400);
    expect(image.width).toBe(400);
    expect(image.width / image.height).toBe(widthToHeight);

    testInputProperty(image, "height", "H", image.height, 80);
    expect(image.height).toBe(80);
    expect(image.width / image.height).toBe(widthToHeight);
  });

  it("should display fontSize for bound text", () => {
    const container = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    const text = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      containerId: container.id,
      fontSize: 20,
    });
    h.app.scene.mutateElement(container, {
      boundElements: [{ type: "text", id: text.id }],
    });
    API.setElements([container, text]);

    API.setSelectedElements([container]);
    const fontSize = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSize).toBeDefined();

    UI.updateInput(fontSize, "40");

    expect(text.fontSize).toBe(40);
  });
});

// multiple elements
describe("stats for multiple elements", () => {
  beforeEach(async () => {
    mouse.reset();
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should display MIXED for elements with different values", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    UI.clickTool("ellipse");
    mouse.down(50, 50);
    mouse.up(100, 100);

    UI.clickTool("diamond");
    mouse.down(-100, -100);
    mouse.up(125, 145);

    API.setAppState({
      selectedElementIds: h.elements.reduce((acc, el) => {
        acc[el.id] = true;
        return acc;
      }, {} as Record<string, true>),
    });

    elementStats = stats?.querySelector("#elementStats");

    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width?.value).toBe("Mixed");
    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height?.value).toBe("Mixed");
    const angle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(angle.value).toBe("0");

    UI.updateInput(width, "250");
    h.elements.forEach((el) => {
      expect(el.width).toBe(250);
    });

    UI.updateInput(height, "450");
    h.elements.forEach((el) => {
      expect(el.height).toBe(450);
    });
  });

  it("should display a property when one of the elements is editable for that property", async () => {
    // text, rectangle, frame
    UI.clickTool("text");
    mouse.clickAt(20, 30);
    const textEditorSelector = ".excalidraw-textEditorContainer > textarea";
    const editor = await getTextEditor(textEditorSelector, true);
    updateTextEditor(editor, "Hello!");
    act(() => {
      editor.blur();
    });

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    const frame = API.createElement({
      type: "frame",
      x: 150,
      width: 150,
    });

    API.setElements([...h.elements, frame]);

    const text = h.elements.find((el) => el.type === "text");
    const rectangle = h.elements.find((el) => el.type === "rectangle");

    API.setAppState({
      selectedElementIds: h.elements.reduce((acc, el) => {
        acc[el.id] = true;
        return acc;
      }, {} as Record<string, true>),
    });

    elementStats = stats?.querySelector("#elementStats");

    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).toBeDefined();
    expect(width.value).toBe("Mixed");

    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).toBeDefined();
    expect(height.value).toBe("Mixed");

    const angle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(angle).toBeDefined();
    expect(angle.value).toBe("0");

    const fontSize = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSize).toBeDefined();

    // changing width does not affect text
    UI.updateInput(width, "200");

    expect(rectangle?.width).toBe(200);
    expect(frame.width).toBe(200);
    expect(text?.width).not.toBe(200);

    UI.updateInput(angle, "40");

    const angleInRadian = degreesToRadians(40 as Degrees);
    expect(rectangle?.angle).toBeCloseTo(angleInRadian, 4);
    expect(text?.angle).toBeCloseTo(angleInRadian, 4);
    expect(frame.angle).toBe(0);
  });

  it("should treat groups as single units", () => {
    const createAndSelectGroup = () => {
      UI.clickTool("rectangle");
      mouse.down();
      mouse.up(100, 100);

      UI.clickTool("rectangle");
      mouse.down(0, 0);
      mouse.up(100, 100);

      mouse.reset();
      Keyboard.withModifierKeys({ shift: true }, () => {
        mouse.click();
      });

      API.executeAction(actionGroup);
    };

    createAndSelectGroup();

    const elementsInGroup = h.elements.filter((el) => isInGroup(el));
    let [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);

    elementStats = stats?.querySelector("#elementStats");

    const x = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(x).toBeDefined();
    expect(Number(x.value)).toBe(x1);

    UI.updateInput(x, "300");

    expect(h.elements[0].x).toBe(300);
    expect(h.elements[1].x).toBe(400);
    expect(x.value).toBe("300");

    const y = UI.queryStatsProperty("Y")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(y).toBeDefined();
    expect(Number(y.value)).toBe(y1);

    UI.updateInput(y, "200");

    expect(h.elements[0].y).toBe(200);
    expect(h.elements[1].y).toBe(300);
    expect(y.value).toBe("200");

    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).toBeDefined();
    expect(Number(width.value)).toBe(200);

    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).toBeDefined();
    expect(Number(height.value)).toBe(200);

    UI.updateInput(width, "400");

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    let newGroupWidth = x2 - x1;

    expect(newGroupWidth).toBeCloseTo(400, 4);

    UI.updateInput(width, "300");

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    newGroupWidth = x2 - x1;
    expect(newGroupWidth).toBeCloseTo(300, 4);

    UI.updateInput(height, "500");

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    const newGroupHeight = y2 - y1;
    expect(newGroupHeight).toBeCloseTo(500, 4);
  });
});
