import { reseed } from "../random";
import React from "react";
import ReactDOM from "react-dom";
import * as Renderer from "../renderer/renderScene";
import { render, fireEvent } from "./test-utils";
import App from "../components/App";
import { ToolName } from "./queries/toolQueries";
import { KEYS, Key } from "../keys";
import { setDateTimeForTests } from "../utils";
import { ExcalidrawElement } from "../element/types";
import { handlerRectangles } from "../element";

const { h } = window;

const renderScene = jest.spyOn(Renderer, "renderScene");
let getByToolName: (name: string) => HTMLElement = null!;
let canvas: HTMLCanvasElement = null!;

function clickTool(toolName: ToolName) {
  fireEvent.click(getByToolName(toolName));
}

let lastClientX = 0;
let lastClientY = 0;
let pointerType: "mouse" | "pen" | "touch" = "mouse";

function pointerDown(
  clientX: number = lastClientX,
  clientY: number = lastClientY,
  altKey: boolean = false,
  shiftKey: boolean = false,
) {
  lastClientX = clientX;
  lastClientY = clientY;
  fireEvent.pointerDown(canvas, {
    clientX,
    clientY,
    altKey,
    shiftKey,
    pointerId: 1,
    pointerType,
  });
}

function pointer2Down(clientX: number, clientY: number) {
  fireEvent.pointerDown(canvas, {
    clientX,
    clientY,
    pointerId: 2,
    pointerType,
  });
}

function pointer2Move(clientX: number, clientY: number) {
  fireEvent.pointerMove(canvas, {
    clientX,
    clientY,
    pointerId: 2,
    pointerType,
  });
}

function pointer2Up(clientX: number, clientY: number) {
  fireEvent.pointerUp(canvas, {
    clientX,
    clientY,
    pointerId: 2,
    pointerType,
  });
}

function pointerMove(
  clientX: number = lastClientX,
  clientY: number = lastClientY,
  altKey: boolean = false,
  shiftKey: boolean = false,
) {
  lastClientX = clientX;
  lastClientY = clientY;
  fireEvent.pointerMove(canvas, {
    clientX,
    clientY,
    altKey,
    shiftKey,
    pointerId: 1,
    pointerType,
  });
}

function pointerUp(
  clientX: number = lastClientX,
  clientY: number = lastClientY,
  altKey: boolean = false,
  shiftKey: boolean = false,
) {
  lastClientX = clientX;
  lastClientY = clientY;
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType, shiftKey, altKey });
}

function hotkeyDown(key: Key) {
  fireEvent.keyDown(document, { key: KEYS[key] });
}

function hotkeyUp(key: Key) {
  fireEvent.keyUp(document, {
    key: KEYS[key],
  });
}

function keyDown(
  key: string,
  ctrlKey: boolean = false,
  shiftKey: boolean = false,
) {
  fireEvent.keyDown(document, { key, ctrlKey, shiftKey });
}

function keyUp(
  key: string,
  ctrlKey: boolean = false,
  shiftKey: boolean = false,
) {
  fireEvent.keyUp(document, {
    key,
    ctrlKey,
    shiftKey,
  });
}

function hotkeyPress(key: Key) {
  hotkeyDown(key);
  hotkeyUp(key);
}

function keyPress(
  key: string,
  ctrlKey: boolean = false,
  shiftKey: boolean = false,
) {
  keyDown(key, ctrlKey, shiftKey);
  keyUp(key, ctrlKey, shiftKey);
}

function clickLabeledElement(label: string) {
  const element = document.querySelector(`[aria-label='${label}']`);
  if (!element) {
    throw new Error(`No labeled element found: ${label}`);
  }
  fireEvent.click(element);
}

function getSelectedElement(): ExcalidrawElement {
  const selectedElements = h.elements.filter(
    (element) => h.state.selectedElementIds[element.id],
  );
  if (selectedElements.length !== 1) {
    throw new Error(
      `expected 1 selected element; got ${selectedElements.length}`,
    );
  }
  return selectedElements[0];
}

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;
function getResizeHandles() {
  const rects = handlerRectangles(
    getSelectedElement(),
    h.state.zoom,
    pointerType,
  ) as {
    [T in HandlerRectanglesRet]: [number, number, number, number];
  };

  const rv: { [K in keyof typeof rects]: [number, number] } = {} as any;

  for (const handlePos in rects) {
    const [x, y, width, height] = rects[handlePos as keyof typeof rects];

    rv[handlePos as keyof typeof rects] = [x + width / 2, y + height / 2];
  }

  return rv;
}

/**
 * This is always called at the end of your test, so usually you don't need to call it.
 * However, if you have a long test, you might want to call it during the test so it's easier
 * to debug where a test failure came from.
 */
function checkpoint(name: string) {
  expect(renderScene.mock.calls.length).toMatchSnapshot(
    `[${name}] number of renders`,
  );
  expect(h.state).toMatchSnapshot(`[${name}] appState`);
  expect(h.history.getSnapshotForTest()).toMatchSnapshot(`[${name}] history`);
  expect(h.elements.length).toMatchSnapshot(`[${name}] number of elements`);
  h.elements.forEach((element, i) =>
    expect(element).toMatchSnapshot(`[${name}] element ${i}`),
  );
}

beforeEach(() => {
  // Unmount ReactDOM from root
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

  localStorage.clear();
  renderScene.mockClear();
  h.history.clear();
  reseed(7);
  setDateTimeForTests("201933152653");
  pointerType = "mouse";

  const renderResult = render(<App />);

  getByToolName = renderResult.getByToolName;
  canvas = renderResult.container.querySelector("canvas")!;
});

afterEach(() => {
  checkpoint("end of test");
});

describe("regression tests", () => {
  it("draw every type of shape", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    clickTool("diamond");
    pointerDown(30, 10);
    pointerMove(40, 20);
    pointerUp();

    clickTool("ellipse");
    pointerDown(50, 10);
    pointerMove(60, 20);
    pointerUp();

    clickTool("arrow");
    pointerDown(70, 10);
    pointerMove(80, 20);
    pointerUp();

    clickTool("line");
    pointerDown(90, 10);
    pointerMove(100, 20);
    pointerUp();

    clickTool("arrow");
    pointerDown(10, 30);
    pointerUp();
    pointerMove(20, 40);
    pointerUp();
    pointerMove(10, 50);
    pointerUp();
    hotkeyPress("ENTER");

    clickTool("line");
    pointerDown(30, 30);
    pointerUp();
    pointerMove(40, 40);
    pointerUp();
    pointerMove(30, 50);
    pointerUp();
    hotkeyPress("ENTER");
  });

  it("click to select a shape", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    clickTool("rectangle");
    pointerDown(30, 10);
    pointerMove(40, 20);
    pointerUp();

    const prevSelectedId = getSelectedElement().id;
    pointerDown(10, 10);
    pointerUp();
    expect(getSelectedElement().id).not.toEqual(prevSelectedId);
  });

  for (const [keys, shape] of [
    ["2r", "rectangle"],
    ["3d", "diamond"],
    ["4e", "ellipse"],
    ["5a", "arrow"],
    ["6l", "line"],
  ] as [string, ExcalidrawElement["type"]][]) {
    for (const key of keys) {
      it(`hotkey ${key} selects ${shape} tool`, () => {
        keyPress(key);

        pointerDown(10, 10);
        pointerMove(20, 20);
        pointerUp();

        expect(getSelectedElement().type).toBe(shape);
      });
    }
  }

  it("change the properties of a shape", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    clickLabeledElement("Background");
    clickLabeledElement("#fa5252");
    clickLabeledElement("Stroke");
    clickLabeledElement("#5f3dc4");
    expect(getSelectedElement().backgroundColor).toBe("#fa5252");
    expect(getSelectedElement().strokeColor).toBe("#5f3dc4");
  });

  it("resize an element, trying every resize handle", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    const resizeHandles = getResizeHandles();
    delete resizeHandles.rotation; // exclude rotation handle
    for (const handlePos in resizeHandles) {
      const [x, y] = resizeHandles[handlePos as keyof typeof resizeHandles];
      const { width: prevWidth, height: prevHeight } = getSelectedElement();
      pointerDown(x, y);
      pointerMove(x - 5, y - 5);
      pointerUp();
      const {
        width: nextWidthNegative,
        height: nextHeightNegative,
      } = getSelectedElement();
      expect(
        prevWidth !== nextWidthNegative || prevHeight !== nextHeightNegative,
      ).toBeTruthy();
      checkpoint(`resize handle ${handlePos} (-5, -5)`);

      pointerDown();
      pointerMove(x, y);
      pointerUp();
      const { width, height } = getSelectedElement();
      expect(width).toBe(prevWidth);
      expect(height).toBe(prevHeight);
      checkpoint(`unresize handle ${handlePos} (-5, -5)`);

      pointerDown(x, y);
      pointerMove(x + 5, y + 5);
      pointerUp();
      const {
        width: nextWidthPositive,
        height: nextHeightPositive,
      } = getSelectedElement();
      expect(
        prevWidth !== nextWidthPositive || prevHeight !== nextHeightPositive,
      ).toBeTruthy();
      checkpoint(`resize handle ${handlePos} (+5, +5)`);

      pointerDown();
      pointerMove(x, y);
      pointerUp();
      const { width: finalWidth, height: finalHeight } = getSelectedElement();
      expect(finalWidth).toBe(prevWidth);
      expect(finalHeight).toBe(prevHeight);

      checkpoint(`unresize handle ${handlePos} (+5, +5)`);
    }
  });

  it("click on an element and drag it", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    const { x: prevX, y: prevY } = getSelectedElement();
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    const { x: nextX, y: nextY } = getSelectedElement();
    expect(nextX).toBeGreaterThan(prevX);
    expect(nextY).toBeGreaterThan(prevY);

    checkpoint("dragged");

    pointerDown();
    pointerMove(10, 10);
    pointerUp();

    const { x, y } = getSelectedElement();
    expect(x).toBe(prevX);
    expect(y).toBe(prevY);
  });

  it("alt-drag duplicates an element", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    expect(
      h.elements.filter((element) => element.type === "rectangle").length,
    ).toBe(1);
    pointerDown(10, 10, true);
    pointerMove(20, 20, true);
    pointerUp(20, 20, true);
    expect(
      h.elements.filter((element) => element.type === "rectangle").length,
    ).toBe(2);
  });

  it("click-drag to select a group", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    clickTool("rectangle");
    pointerDown(30, 10);
    pointerMove(40, 20);
    pointerUp();

    clickTool("rectangle");
    pointerDown(50, 10);
    pointerMove(60, 20);
    pointerUp();

    pointerDown(0, 0);
    pointerMove(45, 25);
    pointerUp();

    expect(
      h.elements.filter((element) => h.state.selectedElementIds[element.id])
        .length,
    ).toBe(2);
  });

  it("shift-click to select a group, then drag", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    clickTool("rectangle");
    pointerDown(30, 10);
    pointerMove(40, 20);
    pointerUp();

    const prevRectsXY = h.elements
      .filter((element) => element.type === "rectangle")
      .map((element) => ({ x: element.x, y: element.y }));
    pointerDown(10, 10);
    pointerUp();
    pointerDown(30, 10, false, true);
    pointerUp();
    pointerDown(30, 10);
    pointerMove(40, 20);
    pointerUp();
    h.elements
      .filter((element) => element.type === "rectangle")
      .forEach((element, i) => {
        expect(element.x).toBeGreaterThan(prevRectsXY[i].x);
        expect(element.y).toBeGreaterThan(prevRectsXY[i].y);
      });
  });

  it("pinch-to-zoom works", () => {
    expect(h.state.zoom).toBe(1);
    pointerType = "touch";
    pointerDown(50, 50);
    pointer2Down(60, 50);
    pointerMove(40, 50);
    pointer2Move(60, 50);
    expect(h.state.zoom).toBeGreaterThan(1);
    const zoomed = h.state.zoom;
    pointerMove(45, 50);
    pointer2Move(55, 50);
    expect(h.state.zoom).toBeLessThan(zoomed);
    pointerUp(45, 50);
    pointer2Up(55, 50);
  });

  it("two-finger scroll works", () => {
    const startScrollY = h.state.scrollY;
    pointerDown(50, 50);
    pointer2Down(60, 50);
    pointerMove(50, 40);
    pointer2Move(60, 40);
    pointerUp(50, 40);
    pointer2Up(60, 40);
    expect(h.state.scrollY).toBeLessThan(startScrollY);

    const startScrollX = h.state.scrollX;
    pointerDown(50, 50);
    pointer2Down(50, 60);
    pointerMove(60, 50);
    pointer2Move(60, 60);
    pointerUp(60, 50);
    pointer2Up(60, 60);
    expect(h.state.scrollX).toBeGreaterThan(startScrollX);
  });

  it("spacebar + drag scrolls the canvas", () => {
    const { scrollX: startScrollX, scrollY: startScrollY } = h.state;
    hotkeyDown("SPACE");
    pointerDown(50, 50);
    pointerMove(60, 60);
    pointerUp();
    hotkeyUp("SPACE");
    const { scrollX, scrollY } = h.state;
    expect(scrollX).not.toEqual(startScrollX);
    expect(scrollY).not.toEqual(startScrollY);
  });

  it("arrow keys", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();
    hotkeyPress("ARROW_LEFT");
    hotkeyPress("ARROW_LEFT");
    hotkeyPress("ARROW_RIGHT");
    hotkeyPress("ARROW_UP");
    hotkeyPress("ARROW_UP");
    hotkeyPress("ARROW_DOWN");
  });

  it("undo/redo drawing an element", () => {
    clickTool("rectangle");
    pointerDown(10, 10);
    pointerMove(20, 20);
    pointerUp();

    clickTool("rectangle");
    pointerDown(30, 10);
    pointerMove(40, 20);
    pointerUp();

    clickTool("arrow");
    pointerDown(10, 30);
    pointerUp();
    pointerMove(20, 40);
    pointerDown(20, 40);
    pointerUp();
    pointerMove(10, 50);
    pointerDown(10, 50);
    pointerUp();
    hotkeyPress("ENTER");

    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(3);
    keyPress("z", true); // press twice for multi arrow
    keyPress("z", true);
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(2);
    keyPress("z", true);
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(1);
    keyPress("z", true, true);
    expect(h.elements.filter((element) => !element.isDeleted).length).toBe(2);
  });

  it("zoom hotkeys", () => {
    expect(h.state.zoom).toBe(1);
    fireEvent.keyDown(document, { code: "Equal", ctrlKey: true });
    fireEvent.keyUp(document, { code: "Equal", ctrlKey: true });
    expect(h.state.zoom).toBeGreaterThan(1);
    fireEvent.keyDown(document, { code: "Minus", ctrlKey: true });
    fireEvent.keyUp(document, { code: "Minus", ctrlKey: true });
    expect(h.state.zoom).toBe(1);
  });
});
