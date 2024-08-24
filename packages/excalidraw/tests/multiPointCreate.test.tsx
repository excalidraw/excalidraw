import React from "react";
import ReactDOM from "react-dom";
import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";
import { Excalidraw } from "../index";
import * as StaticScene from "../renderer/staticScene";
import * as InteractiveCanvas from "../renderer/interactiveScene";
import { KEYS } from "../keys";
import type { ExcalidrawLinearElement } from "../element/types";
import { reseed } from "../random";
import { vi } from "vitest";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

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

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`7`);
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
    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`7`);
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
});
