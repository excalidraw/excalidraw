import React from "react";
import { vi } from "vitest";

import { bindOrUnbindLinearElement } from "@excalidraw/element/binding";

import { KEYS, reseed } from "@excalidraw/common";

import "@excalidraw/utils/test-utils";

import type {
  ExcalidrawLinearElement,
  NonDeleted,
  ExcalidrawRectangleElement,
} from "@excalidraw/element/types";

import type Scene from "@excalidraw/excalidraw/scene/Scene";

import { Excalidraw } from "../index";
import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import { UI, Pointer, Keyboard } from "./helpers/ui";
import { render, fireEvent, act, unmountComponent } from "./test-utils";

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

describe("move element", () => {
  it("rectangle", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    const canvas = container.querySelector("canvas.interactive")!;

    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(1);
      expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
      expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);

      renderInteractiveScene.mockClear();
      renderStaticScene.mockClear();
    }

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`3`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`2`);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect([h.elements[0].x, h.elements[0].y]).toEqual([0, 40]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("rectangles with binding arrow", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // create elements
    const rectA = UI.createElement("rectangle", { size: 100 });
    const rectB = UI.createElement("rectangle", { x: 200, y: 0, size: 300 });
    const arrow = UI.createElement("arrow", { x: 110, y: 50, size: 80 });
    const elementsMap = h.app.scene.getNonDeletedElementsMap();
    act(() => {
      // bind line to two rectangles
      bindOrUnbindLinearElement(
        arrow.get() as NonDeleted<ExcalidrawLinearElement>,
        rectA.get() as ExcalidrawRectangleElement,
        rectB.get() as ExcalidrawRectangleElement,
        elementsMap,
        {} as Scene,
      );
    });

    // select the second rectangle
    new Pointer("mouse").clickOn(rectB);

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
      `17`,
    );
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`13`);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(3);
    expect(h.state.selectedElementIds[rectB.id]).toBeTruthy();
    expect([rectA.x, rectA.y]).toEqual([0, 0]);
    expect([rectB.x, rectB.y]).toEqual([200, 0]);
    expect([arrow.x, arrow.y]).toEqual([110, 50]);
    expect([arrow.width, arrow.height]).toEqual([80, 80]);

    renderInteractiveScene.mockClear();
    renderStaticScene.mockClear();

    // Move selected rectangle
    Keyboard.keyDown(KEYS.ARROW_RIGHT);
    Keyboard.keyDown(KEYS.ARROW_DOWN);
    Keyboard.keyDown(KEYS.ARROW_DOWN);

    // Check that the arrow size has been changed according to moving the rectangle
    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`3`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`3`);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(3);
    expect(h.state.selectedElementIds[rectB.id]).toBeTruthy();
    expect([rectA.x, rectA.y]).toEqual([0, 0]);
    expect([rectB.x, rectB.y]).toEqual([201, 2]);
    expect([[arrow.x, arrow.y]]).toCloselyEqualPoints([[107.07, 47.07]]);
    expect([[arrow.width, arrow.height]]).toCloselyEqualPoints([[86.86, 87.3]]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});

describe("duplicate element on move when ALT is clicked", () => {
  it("rectangle", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    const canvas = container.querySelector("canvas.interactive")!;

    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(1);
      expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
      expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);

      renderInteractiveScene.mockClear();
      renderStaticScene.mockClear();
    }

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40, altKey: true });

    // firing another pointerMove event with alt key pressed should NOT trigger
    // another duplication
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40, altKey: true });
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 60 });
    fireEvent.pointerUp(canvas);

    // TODO: This used to be 4, but binding made it go up to 5. Do we need
    // that additional render?
    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(`4`);
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`3`);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(2);

    // previous element should stay intact
    expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);
    expect([h.elements[1].x, h.elements[1].y]).toEqual([-10, 60]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});
