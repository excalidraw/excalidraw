import { fireEvent, queryByTestId } from "@testing-library/react";
import { Keyboard, Pointer, UI } from "../../tests/helpers/ui";
import { getStepSizedValue } from "./utils";
import {
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../tests/test-utils";
import * as StaticScene from "../../renderer/staticScene";
import { vi } from "vitest";
import { reseed } from "../../random";
import { setDateTimeForTests } from "../../utils";
import { Excalidraw } from "../..";
import { t } from "../../i18n";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "../../element/types";
import { degreeToRadian, rotate } from "../../math";
import { getTextEditor, updateTextEditor } from "../../tests/queries/dom";
import { getCommonBounds, isTextElement } from "../../element";
import { API } from "../../tests/helpers/api";
import { actionGroup } from "../../actions";
import { isInGroup } from "../../groups";

const { h } = window;
const mouse = new Pointer("mouse");
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
let stats: HTMLElement | null = null;
let elementStats: HTMLElement | null | undefined = null;

const getStatsProperty = (label: string) => {
  if (elementStats) {
    const properties = elementStats?.querySelector(".statsItem");
    return properties?.querySelector?.(
      `.drag-input-container[data-testid="${label}"]`,
    );
  }

  return null;
};

const testInputProperty = (
  element: ExcalidrawElement,
  property: "x" | "y" | "width" | "height" | "angle" | "fontSize",
  label: string,
  initialValue: number,
  nextValue: number,
) => {
  const input = getStatsProperty(label)?.querySelector(
    ".drag-input",
  ) as HTMLInputElement;
  expect(input).not.toBeNull();
  expect(input.value).toBe(initialValue.toString());
  input?.focus();
  input.value = nextValue.toString();
  input?.blur();
  if (property === "angle") {
    expect(element[property]).toBe(degreeToRadian(Number(nextValue)));
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

// single element
describe("stats for a generic element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    h.elements = [];

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
    expect(stats).not.toBeNull();
    expect(elementStats).not.toBeNull();

    // title
    const title = elementStats?.querySelector("h3");
    expect(title?.lastChild?.nodeValue)?.toBe(t("stats.elementProperties"));

    // element type
    const elementType = elementStats?.querySelector(".elementType");
    expect(elementType).not.toBeNull();
    expect(elementType?.lastChild?.nodeValue).toBe(t("element.rectangle"));

    // properties
    const properties = elementStats?.querySelector(".statsItem");
    expect(properties?.childNodes).not.toBeNull();
    ["X", "Y", "W", "H", "A"].forEach((label) => () => {
      expect(
        properties?.querySelector?.(
          `.drag-input-container[data-testid="${label}"]`,
        ),
      ).not.toBeNull();
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

    const input = getStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe(rectangle.width.toString());
    input?.focus();
    input.value = "123.123";
    input?.blur();
    expect(h.elements.length).toBe(1);
    expect(rectangle.id).toBe(rectangleId);
    expect(input.value).toBe("123.12");
    expect(rectangle.width).toBe(123.12);

    input?.focus();
    input.value = "88.98766";
    input?.blur();
    expect(input.value).toBe("88.99");
    expect(rectangle.width).toBe(88.99);
  });

  it("should update input x and y when angle is changed", () => {
    const rectangle = h.elements[0];
    const [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    const [topLeftX, topLeftY] = rotate(
      rectangle.x,
      rectangle.y,
      cx,
      cy,
      rectangle.angle,
    );

    const xInput = getStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    const yInput = getStatsProperty("Y")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(xInput.value).toBe(topLeftX.toString());
    expect(yInput.value).toBe(topLeftY.toString());

    testInputProperty(rectangle, "angle", "A", 0, 45);

    let [newTopLeftX, newTopLeftY] = rotate(
      rectangle.x,
      rectangle.y,
      cx,
      cy,
      rectangle.angle,
    );

    expect(newTopLeftX.toString()).not.toEqual(xInput.value);
    expect(newTopLeftY.toString()).not.toEqual(yInput.value);

    testInputProperty(rectangle, "angle", "A", 45, 66);

    [newTopLeftX, newTopLeftY] = rotate(
      rectangle.x,
      rectangle.y,
      cx,
      cy,
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
    const [topLeftX, topLeftY] = rotate(
      rectangle.x,
      rectangle.y,
      cx,
      cy,
      rectangle.angle,
    );
    testInputProperty(rectangle, "width", "W", rectangle.width, 400);
    [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    let [currentTopLeftX, currentTopLeftY] = rotate(
      rectangle.x,
      rectangle.y,
      cx,
      cy,
      rectangle.angle,
    );
    expect(currentTopLeftX).toBeCloseTo(topLeftX, 4);
    expect(currentTopLeftY).toBeCloseTo(topLeftY, 4);

    testInputProperty(rectangle, "height", "H", rectangle.height, 400);
    [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    [currentTopLeftX, currentTopLeftY] = rotate(
      rectangle.x,
      rectangle.y,
      cx,
      cy,
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

    h.elements = [];

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
    await new Promise((r) => setTimeout(r, 0));
    updateTextEditor(editor, "Hello!");
    editor.blur();

    const text = h.elements[0] as ExcalidrawTextElement;
    mouse.clickOn(text);

    elementStats = stats?.querySelector("#elementStats");

    // can change font size
    const input = getStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe(text.fontSize.toString());
    input?.focus();
    input.value = "36";
    input?.blur();
    expect(text.fontSize).toBe(36);

    // cannot change width or height
    const width = getStatsProperty("W")?.querySelector(".drag-input");
    expect(width).toBeUndefined();
    const height = getStatsProperty("H")?.querySelector(".drag-input");
    expect(height).toBeUndefined();

    // min font size is 4
    input.focus();
    input.value = "0";
    input.blur();
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
    h.elements = [frame];
    h.setState({
      selectedElementIds: {
        [frame.id]: true,
      },
    });

    elementStats = stats?.querySelector("#elementStats");

    expect(elementStats).not.toBeNull();

    // cannot change angle
    const angle = getStatsProperty("A")?.querySelector(".drag-input");
    expect(angle).toBeUndefined();

    // can change width or height
    testInputProperty(frame, "width", "W", frame.width, 250);
    testInputProperty(frame, "height", "H", frame.height, 500);
  });

  it("image element", () => {
    const image = API.createElement({ type: "image", width: 200, height: 100 });
    h.elements = [image];
    mouse.clickOn(image);
    h.setState({
      selectedElementIds: {
        [image.id]: true,
      },
    });
    elementStats = stats?.querySelector("#elementStats");
    expect(elementStats).not.toBeNull();
    const widthToHeight = image.width / image.height;

    // when width or height is changed, the aspect ratio is preserved
    testInputProperty(image, "width", "W", image.width, 400);
    expect(image.width).toBe(400);
    expect(image.width / image.height).toBe(widthToHeight);

    testInputProperty(image, "height", "H", image.height, 80);
    expect(image.height).toBe(80);
    expect(image.width / image.height).toBe(widthToHeight);
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

    h.elements = [];

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

    h.setState({
      selectedElementIds: h.elements.reduce((acc, el) => {
        acc[el.id] = true;
        return acc;
      }, {} as Record<string, true>),
    });

    elementStats = stats?.querySelector("#elementStats");

    const width = getStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width?.value).toBe("Mixed");
    const height = getStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height?.value).toBe("Mixed");
    const angle = getStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(angle.value).toBe("0");

    width.focus();
    width.value = "250";
    width.blur();
    h.elements.forEach((el) => {
      expect(el.width).toBe(250);
    });

    height.focus();
    height.value = "450";
    height.blur();
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
    await new Promise((r) => setTimeout(r, 0));
    updateTextEditor(editor, "Hello!");
    editor.blur();

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    const frame = API.createElement({
      id: "id0",
      type: "frame",
      x: 150,
      width: 150,
    });

    h.elements = [...h.elements, frame];

    const text = h.elements.find((el) => el.type === "text");
    const rectangle = h.elements.find((el) => el.type === "rectangle");

    h.setState({
      selectedElementIds: h.elements.reduce((acc, el) => {
        acc[el.id] = true;
        return acc;
      }, {} as Record<string, true>),
    });

    elementStats = stats?.querySelector("#elementStats");

    const width = getStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).not.toBeNull();
    expect(width.value).toBe("Mixed");

    const height = getStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).not.toBeNull();
    expect(height.value).toBe("Mixed");

    const angle = getStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(angle).not.toBeNull();
    expect(angle.value).toBe("0");

    const fontSize = getStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSize).not.toBeNull();

    // changing width does not affect text
    width.focus();
    width.value = "200";
    width.blur();

    expect(rectangle?.width).toBe(200);
    expect(frame.width).toBe(200);
    expect(text?.width).not.toBe(200);

    angle.focus();
    angle.value = "40";
    angle.blur();

    const angleInRadian = degreeToRadian(40);
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

      h.app.actionManager.executeAction(actionGroup);
    };

    createAndSelectGroup();

    const elementsInGroup = h.elements.filter((el) => isInGroup(el));
    let [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);

    elementStats = stats?.querySelector("#elementStats");

    const x = getStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(x).not.toBeNull();
    expect(Number(x.value)).toBe(x1);

    x.focus();
    x.value = "300";
    x.blur();

    expect(h.elements[0].x).toBe(300);
    expect(h.elements[1].x).toBe(400);
    expect(x.value).toBe("300");

    const y = getStatsProperty("Y")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(y).not.toBeNull();
    expect(Number(y.value)).toBe(y1);

    y.focus();
    y.value = "200";
    y.blur();

    expect(h.elements[0].y).toBe(200);
    expect(h.elements[1].y).toBe(300);
    expect(y.value).toBe("200");

    const width = getStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).not.toBeNull();
    expect(Number(width.value)).toBe(200);

    const height = getStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).not.toBeNull();
    expect(Number(height.value)).toBe(200);

    width.focus();
    width.value = "400";
    width.blur();

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    let newGroupWidth = x2 - x1;

    expect(newGroupWidth).toBeCloseTo(400, 4);

    width.focus();
    width.value = "300";
    width.blur();

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    newGroupWidth = x2 - x1;
    expect(newGroupWidth).toBeCloseTo(300, 4);

    height.focus();
    height.value = "500";
    height.blur();

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    const newGroupHeight = y2 - y1;
    expect(newGroupHeight).toBeCloseTo(500, 4);
  });
});
