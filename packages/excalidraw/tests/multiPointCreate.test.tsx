import React from "react";
import { vi } from "vitest";

import { KEYS, reseed } from "@excalidraw/common";
import { isLinearElement } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import { Keyboard, Pointer, UI } from "./helpers/ui";

import {
  render,
  fireEvent,
  screen,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const renderInteractiveScene = vi.spyOn(
  InteractiveCanvas,
  "renderInteractiveScene",
);
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");

beforeEach(() => {
  localStorage.clear();
  renderInteractiveScene.mockClear();
  renderStaticScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("remove shape in non linear elements", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("rectangle", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(h.elements.length).toEqual(0);
  });

  it("ellipse", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("ellipse");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(h.elements.length).toEqual(0);
  });

  it("diamond", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("diamond");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
    expect(h.elements.length).toEqual(0);
  });
});

describe("multi point mode in linear elements", () => {
  it("arrow", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("arrow");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    // first point is added on pointer down
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 });

    // second point, enable multi point
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 60 });

    // third point
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(canvas);
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 140 });

    // done
    fireEvent.pointerDown(canvas);
    fireEvent.pointerUp(canvas);
    fireEvent.keyDown(document, {
      key: KEYS.ENTER,
    });

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
      `11`,
    );
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);
    expect(h.elements.length).toEqual(1);

    const element = h.elements[0] as ExcalidrawLinearElement;

    expect(element.type).toEqual("arrow");
    expect(element.x).toEqual(30);
    expect(element.y).toEqual(30);
    expect(element.points).toEqual([
      [0, 0],
      [20, 30],
      [70, 110],
    ]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("line", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("line");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    // first point is added on pointer down
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 });

    // second point, enable multi point
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 60 });

    // third point
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(canvas);
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 140 });

    // done
    fireEvent.pointerDown(canvas);
    fireEvent.pointerUp(canvas);
    fireEvent.keyDown(document, {
      key: KEYS.ENTER,
    });
    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
      `11`,
    );
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);
    expect(h.elements.length).toEqual(1);

    const element = h.elements[0] as ExcalidrawLinearElement;

    expect(element.type).toEqual("line");
    expect(element.x).toEqual(30);
    expect(element.y).toEqual(30);
    expect(element.points).toEqual([
      [0, 0],
      [20, 30],
      [70, 110],
    ]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("prevents switching to eraser while creating a multi-point line", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("line");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    // first point is added on pointer down
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 });

    // second point, enable multi point
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 60 });

    expect(h.state.activeTool.type).toEqual("line");

    // try to switch to eraser
    fireEvent.keyDown(canvas, {
      key: KEYS.E,
    });

    expect(h.state.activeTool.type).toEqual("line");

    // third point should still be added to the line instead of erasing
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(canvas);
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 140 });

    // done
    fireEvent.pointerDown(canvas);
    fireEvent.pointerUp(canvas);
    fireEvent.keyDown(document, {
      key: KEYS.ENTER,
    });

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
      `11`,
    );
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`7`);
    expect(h.elements.length).toEqual(1);
  });
});

describe("sidebar styling during multi-point creation", () => {
  const mouse = new Pointer("mouse");
  const initialPoints = [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(120, 50),
  ];

  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const startStroke = (tool: "line" | "arrow") => {
    UI.clickTool(tool);
    UI.clickOnTestId("strokeWidth-medium");
    mouse.clickAt(70, 90);
    mouse.moveTo(190, 140);
    mouse.clickAt(190, 140);

    const element = h.elements[0];
    assert(isLinearElement(element));
    expect(element.type).toBe(tool);
    expect(element.points).toEqual(initialPoints);
    expect(element.strokeWidth).toBe(2);
    expect(h.state.multiElement).toBe(element);
    expect(h.state.newElement).toBe(element);
    expect(h.state.cursorButton).toBe("up");
    return element;
  };

  const chooseWidth = (width: "medium" | "bold") => {
    const radio = screen.getByTestId(`strokeWidth-${width}`);
    expect(h.state.cursorButton).toBe("up");
    expect(radio).toBeEnabled();
    fireEvent.pointerDown(radio, { pointerType: "mouse", pointerId: 1 });
    fireEvent.pointerUp(radio, { pointerType: "mouse", pointerId: 1 });
    fireEvent.click(radio);
    expect(radio).toBeChecked();
  };

  const continueStroke = () => {
    mouse.moveTo(320, 260);
    mouse.clickAt(320, 260);

    const element = h.elements[0];
    assert(isLinearElement(element));
    expect(element.points).toEqual([
      ...initialPoints,
      pointFrom<LocalPoint>(250, 170),
    ]);
    expect(h.state.multiElement).toBe(element);
    expect(h.state.newElement).toBe(element);
    return element;
  };

  it.each(["line", "arrow"] as const)(
    "continues a %s after changing stroke width",
    (tool) => {
      const element = startStroke(tool);
      chooseWidth("bold");
      expect(h.elements[0].strokeWidth).toBe(4);
      expect(h.elements[0].id).toBe(element.id);

      const continued = continueStroke();
      expect(continued.strokeWidth).toBe(4);
      expect(h.state.activeTool.type).toBe(tool);
    },
  );

  it.each([
    ["line", "unstyled"],
    ["arrow", "same-width"],
  ] as const)("continues a %s with the %s control", (tool, control) => {
    const element = startStroke(tool);
    if (control === "same-width") {
      chooseWidth("medium");
    }

    expect(continueStroke()).toBe(element);
    expect(h.elements[0].strokeWidth).toBe(2);
  });

  it.each([
    ["line", KEYS.ENTER],
    ["arrow", KEYS.ESCAPE],
  ] as const)("finishes a styled %s with %s", (tool, key) => {
    startStroke(tool);
    chooseWidth("bold");
    expect(h.elements[0].strokeWidth).toBe(4);

    Keyboard.keyPress(key, h.app.ownerDocument);
    expect(h.state.multiElement).toBeNull();
    expect(h.state.newElement).toBeNull();

    chooseWidth("medium");
    expect(h.elements[0].strokeWidth).toBe(2);
    expect(h.state.multiElement).toBeNull();
    expect(h.state.newElement).toBeNull();

    UI.clickTool(tool);
    mouse.downAt(430, 370);
    mouse.moveTo(520, 450);
    mouse.upAt(520, 450);

    expect(h.elements).toHaveLength(2);
    const nextStroke = h.elements[1];
    assert(isLinearElement(nextStroke));
    expect(nextStroke.type).toBe(tool);
    expect(nextStroke.isDeleted).toBe(false);
    expect(nextStroke.points).toEqual([
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(90, 80),
    ]);
    expect(h.state.multiElement).toBeNull();
    expect(h.state.newElement).toBeNull();
  });
});
