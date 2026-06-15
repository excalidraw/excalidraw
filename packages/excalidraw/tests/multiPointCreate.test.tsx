import React from "react";
import { vi } from "vitest";

import { KEYS, reseed } from "@excalidraw/common";

import type {
  ExcalidrawArrowElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";
import { API } from "./helpers/api";

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
  it("round arrow can add an intermediate point inside its start rectangle", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    API.setElements([
      API.createElement({
        type: "rectangle",
        id: "startRect",
        x: 100,
        y: 100,
        width: 300,
        height: 200,
      }),
    ]);

    fireEvent.click(getByToolName("arrow"));

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 150 });
    fireEvent.pointerUp(canvas, { clientX: 150, clientY: 150 });

    fireEvent.pointerMove(canvas, { clientX: 220, clientY: 180 });
    fireEvent.pointerDown(canvas, { clientX: 220, clientY: 180 });
    fireEvent.pointerUp(canvas, { clientX: 220, clientY: 180 });
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 250 });

    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 250 });
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 250 });
    fireEvent.keyDown(document, {
      key: KEYS.ENTER,
    });

    const element = h.elements.find(
      (element): element is ExcalidrawLinearElement => element.type === "arrow",
    );

    expect(element).toBeDefined();
    expect(element!.roundness).not.toBeNull();
    expect(element!.points).toEqual([
      [0, 0],
      [70, 30],
      [150, 100],
    ]);
  });

  it("arrow still auto-finalizes when reaching a different rectangle", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    API.setElements([
      API.createElement({
        type: "rectangle",
        id: "startRect",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      }),
      API.createElement({
        type: "rectangle",
        id: "endRect",
        x: 300,
        y: 100,
        width: 100,
        height: 100,
      }),
    ]);

    fireEvent.click(getByToolName("arrow"));

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 150 });
    fireEvent.pointerUp(canvas, { clientX: 150, clientY: 150 });
    fireEvent.pointerMove(canvas, { clientX: 350, clientY: 150 });

    const element = h.elements.find(
      (element): element is ExcalidrawArrowElement => element.type === "arrow",
    );

    expect(element).toBeDefined();
    expect(element!.endBinding?.elementId).toBe("endRect");
  });

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
});
