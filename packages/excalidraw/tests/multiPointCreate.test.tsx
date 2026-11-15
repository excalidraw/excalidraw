import React from "react";
import { vi } from "vitest";

import { KEYS, reseed } from "@excalidraw/common";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { createPasteEvent, serializeAsClipboardJSON } from "../clipboard";

import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import { Keyboard, Pointer, UI } from "./helpers/ui";
import { API } from "./helpers/api";

import {
  render,
  act,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
  GlobalTestState,
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
  it.each(["selection", "rectangle", "line"] as const)(
    "cancels an unfinished elbow arrow when switching to %s",
    async (nextTool) => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const mouse = new Pointer("mouse");
      UI.clickTool("arrow");
      API.setAppState({ currentItemArrowType: "elbow" });
      mouse.clickAt(30, 30);
      mouse.moveTo(100, 100);

      expect(h.state.multiElement).toMatchObject({ elbowed: true });
      expect(h.state.multiElement!.points.length).toBeGreaterThan(2);
      const preview = h.state.multiElement!;
      const points = [...preview.points];

      UI.clickTool(nextTool);

      expect(h.state.activeTool.type).toBe(nextTool);
      expect(h.state.multiElement).toBeNull();
      expect(h.state.newElement).toBeNull();
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
      expect(preview.points).toEqual(points);

      mouse.moveTo(150, 150);
      expect(preview.points).toEqual(points);
      UI.clickTool("arrow");
      mouse.clickAt(200, 200);
      mouse.moveTo(300, 300);
      mouse.click();

      const elements = h.app.scene.getNonDeletedElements();
      expect(elements).toHaveLength(1);
      const arrow = elements[0] as ExcalidrawLinearElement;
      expect(arrow).toMatchObject({ type: "arrow", elbowed: true });
      expect(arrow.points.length).toBeGreaterThan(2);
      expect(arrow.points[0]).toEqual([0, 0]);
      expect(arrow.points[arrow.points.length - 1]).toEqual([100, 100]);

      Keyboard.undo();
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
      Keyboard.redo();
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
      expect(h.app.scene.getNonDeletedElements()[0]).toMatchObject({
        id: arrow.id,
        points: arrow.points,
      });
    },
  );

  it("cancels an unfinished elbow arrow after returning to its starting point", async () => {
    await render(<Excalidraw />);
    const mouse = new Pointer("mouse");
    UI.clickTool("arrow");
    API.setAppState({ currentItemArrowType: "elbow" });
    mouse.clickAt(30, 30);
    mouse.moveTo(100, 100);
    mouse.moveTo(30, 30);

    expect(h.state.multiElement).not.toBeNull();
    UI.clickTool("selection");

    expect(h.state.multiElement).toBeNull();
    expect(h.state.newElement).toBeNull();
    expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
  });

  it("removes bindings when canceling an unfinished elbow arrow through the API", async () => {
    await render(<Excalidraw />);
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);
    const mouse = new Pointer("mouse");
    UI.clickTool("arrow");
    API.setAppState({ currentItemArrowType: "elbow" });
    mouse.clickAt(100, 50);
    mouse.moveTo(200, 150);

    const preview = h.state.multiElement!;
    expect(preview).toMatchObject({
      startBinding: { elementId: rectangle.id },
    });
    expect(rectangle.boundElements).toContainEqual({
      id: preview.id,
      type: "arrow",
    });

    act(() => h.app.setActiveTool({ type: "selection" }));

    expect(h.app.scene.getNonDeletedElements()).toEqual([rectangle]);
    expect(rectangle.boundElements).not.toContainEqual({
      id: preview.id,
      type: "arrow",
    });
  });

  it.each(["clipboard", "library"] as const)(
    "selects elements inserted through %s when finalizing an in-progress arrow",
    async (source) => {
      await render(<Excalidraw autoFocus handleKeyboardGlobally={true} />);
      Object.assign(h.app.ownerDocument, {
        elementFromPoint: () => GlobalTestState.canvas,
      });
      const mouse = new Pointer("mouse");
      UI.clickTool("arrow");
      mouse.clickAt(30, 30);
      mouse.moveTo(100, 100);
      mouse.click();
      mouse.moveTo(150, 50);

      expect(h.state.multiElement?.points).toHaveLength(3);

      const elements = [API.createElement({ type: "rectangle" })];
      await act(async () => {
        if (source === "clipboard") {
          h.app.ownerDocument.dispatchEvent(
            createPasteEvent({
              types: {
                "text/plain": serializeAsClipboardJSON({
                  elements,
                  files: null,
                }),
              },
            }),
          );
        } else {
          h.app.addElementsFromPasteOrLibrary({
            elements,
            files: null,
            position: "cursor",
          });
        }
      });

      await waitFor(() => {
        expect(h.app.scene.getNonDeletedElements()).toHaveLength(2);
      });
      const [arrow, rectangle] = h.app.scene.getNonDeletedElements();
      expect(arrow).toMatchObject({
        type: "arrow",
        points: [
          [0, 0],
          [70, 70],
        ],
      });
      expect(rectangle.type).toBe("rectangle");
      expect(h.state.selectedElementIds).toEqual({ [rectangle.id]: true });
      expect(h.state.multiElement).toBeNull();
      expect(h.state.newElement).toBeNull();
    },
  );

  it.each([
    ["arrow", "selection"],
    ["arrow", "rectangle"],
    ["arrow", "line"],
    ["line", "selection"],
    ["line", "rectangle"],
    ["line", "arrow"],
  ] as const)(
    "cancels an unfinished %s when switching to %s",
    async (drawingTool, nextTool) => {
      await render(<Excalidraw />);
      const mouse = new Pointer("mouse");
      UI.clickTool(drawingTool);
      mouse.clickAt(30, 30);
      mouse.moveTo(100, 100);

      expect(h.state.multiElement?.type).toBe(drawingTool);
      expect(h.elements).toHaveLength(1);

      UI.clickTool(nextTool);

      expect(h.state.activeTool.type).toBe(nextTool);
      expect(h.state.multiElement).toBeNull();
      expect(h.state.newElement).toBeNull();
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);

      mouse.moveTo(150, 150);
      UI.clickTool(drawingTool);
      mouse.downAt(200, 200);
      mouse.moveTo(300, 300);
      mouse.up();

      const elements = h.app.scene.getNonDeletedElements();
      expect(elements).toHaveLength(1);
      expect(elements[0]).toMatchObject({
        type: drawingTool,
        x: 200,
        y: 200,
        points: [
          [0, 0],
          [100, 100],
        ],
      });
    },
  );

  it.each(["arrow", "line"] as const)(
    "preserves committed %s points when switching tools through the API",
    async (drawingTool) => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const mouse = new Pointer("mouse");
      UI.clickTool(drawingTool);
      mouse.clickAt(30, 30);
      mouse.moveTo(100, 100);

      mouse.click();
      mouse.moveTo(150, 50);
      expect(h.state.multiElement?.points).toHaveLength(3);

      act(() => h.app.setActiveTool({ type: "rectangle" }));

      expect(h.state.activeTool.type).toBe("rectangle");
      expect(h.state.multiElement).toBeNull();
      expect(h.state.newElement).toBeNull();
      const committedPoints = [
        [0, 0],
        [70, 70],
      ];
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
      expect(h.app.scene.getNonDeletedElements()[0]).toMatchObject({
        type: drawingTool,
        points: committedPoints,
      });

      Keyboard.undo();
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);
      Keyboard.redo();
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(1);
      expect(h.app.scene.getNonDeletedElements()[0]).toMatchObject({
        points: committedPoints,
      });
    },
  );

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
