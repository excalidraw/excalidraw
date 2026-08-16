import React from "react";
import { vi } from "vitest";
import { CURSOR_TYPE, KEYS, reseed } from "@excalidraw/common";
import { bindBindingElement } from "@excalidraw/element";
import "@excalidraw/utils/test-utils";

import type {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import { UI, Pointer, Keyboard } from "./helpers/ui";
import { render, fireEvent, act, unmountComponent, GlobalTestState } from "./test-utils";

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
    const arrow = UI.createElement("arrow", { x: 105, y: 50, size: 88 });

    act(() => {
      // bind line to two rectangles
      bindBindingElement(
        arrow.get() as NonDeleted<ExcalidrawArrowElement>,
        rectA.get() as NonDeleted<ExcalidrawBindableElement>,
        "orbit",
        "start",
        h.app.scene,
      );
      bindBindingElement(
        arrow.get() as NonDeleted<ExcalidrawArrowElement>,
        rectB.get() as NonDeleted<ExcalidrawBindableElement>,
        "orbit",
        "end",
        h.app.scene,
      );
    });

    // select the second rectangle
    new Pointer("mouse").clickOn(rectB);

    expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
      `16`,
    );
    expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`15`);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(3);
    expect(h.state.selectedElementIds[rectB.id]).toBeTruthy();
    expect([rectA.x, rectA.y]).toEqual([0, 0]);
    expect([rectB.x, rectB.y]).toEqual([200, 0]);
    expect([[arrow.x, arrow.y]]).toCloselyEqualPoints(
      [[106.00000000000001, 55.6867741935484]],
      0,
    );
    expect([[arrow.width, arrow.height]]).toCloselyEqualPoints([[88, 88]], 0);

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
    expect([[arrow.x, arrow.y]]).toCloselyEqualPoints(
      [[106, 55.6867741935484]],
      0,
    );
    expect([[arrow.width, arrow.height]]).toCloselyEqualPoints([[89, 90]], 0);

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

describe("copy cursor on Alt/Option held for duplication", () => {
  it("shows copy cursor on hover when Alt is held over a selected element", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    const canvas = container.querySelector("canvas.interactive")!;

    // create and select a rectangle
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 70 });
    fireEvent.pointerUp(canvas);

    // hover over the element without Alt — expect move cursor
    fireEvent.pointerMove(canvas, { clientX: 55, clientY: 45 });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.MOVE,
    );

    // hover over the element with Alt held — expect copy cursor
    fireEvent.pointerMove(canvas, { clientX: 55, clientY: 45, altKey: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.COPY,
    );

    // release Alt (simulate keyup) — cursor reverts to move
    fireEvent.keyUp(document, { key: KEYS.ALT });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.MOVE,
    );
  });

  it("shows copy cursor during active drag when Alt is held", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    const canvas = container.querySelector("canvas.interactive")!;

    // create and select a rectangle
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 70 });
    fireEvent.pointerUp(canvas);

    // start dragging with Alt held — should show copy cursor
    fireEvent.pointerDown(canvas, { clientX: 55, clientY: 45 });
    fireEvent.pointerMove(canvas, { clientX: 65, clientY: 55, altKey: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.COPY,
    );

    // continue drag without Alt — cursor reverts to move
    fireEvent.pointerMove(canvas, { clientX: 70, clientY: 60, altKey: false });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.MOVE,
    );

    fireEvent.pointerUp(canvas);
  });

  it("does not show copy cursor when no elements are selected", async () => {
    const { container } = await render(<Excalidraw />);
    const canvas = container.querySelector("canvas.interactive")!;

    // move over empty canvas with Alt held — should NOT show copy cursor
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 100, altKey: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).not.toBe(
      CURSOR_TYPE.COPY,
    );
  });

  it("pressing Alt while hovering over a selected element switches cursor to copy immediately", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    const canvas = container.querySelector("canvas.interactive")!;

    // create and select a rectangle
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 70 });
    fireEvent.pointerUp(canvas);

    // hover over the element (no Alt) to establish move cursor
    fireEvent.pointerMove(canvas, { clientX: 55, clientY: 45 });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.MOVE,
    );

    // press Alt key while already hovering — cursor should switch to copy
    fireEvent.keyDown(document, { key: KEYS.ALT });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.COPY,
    );
  });
});
