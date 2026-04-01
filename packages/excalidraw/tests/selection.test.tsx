import React from "react";
import { vi } from "vitest";

import { KEYS, ROUNDNESS, reseed } from "@excalidraw/common";
import { getElementBounds, getElementLineSegments } from "@excalidraw/element";
import { pointFrom, pointRotateRads, type LocalPoint } from "@excalidraw/math";

import { SHAPES } from "../components/shapes";

import { Excalidraw } from "../index";
import * as InteractiveCanvas from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import {
  act,
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  assertSelectedElements,
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

const mouse = new Pointer("mouse");

const getOutlineBounds = (element: ReturnType<typeof API.createElement>) => {
  const sceneElement = API.getElement(element);
  const elementsMap = h.scene.getNonDeletedElementsMap();
  const points = getElementLineSegments(sceneElement, elementsMap).flat();

  return [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1])),
  ] as const;
};

describe("box-selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("should allow adding to selection via box-select when holding shift", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 50,
      height: 50,
    });

    API.setElements([rect1, rect2]);

    mouse.downAt(175, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(85, 70);
    mouse.up();

    assertSelectedElements([rect2.id]);

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.downAt(75, -20);
      mouse.move(-1000, -1000);
      mouse.moveTo(-15, 70);
      mouse.up();
    });

    assertSelectedElements([rect2.id, rect1.id]);
  });

  it("should (de)select element when box-selecting over and out while not holding shift", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    mouse.downAt(75, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(-15, 70);

    assertSelectedElements([rect1.id]);

    mouse.moveTo(100, -100);

    assertSelectedElements([]);

    mouse.up();

    assertSelectedElements([]);
  });

  it("should not select an element when the selection box only partially overlaps it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    mouse.downAt(25, -20);
    mouse.move(-1000, -1000);
    mouse.moveTo(75, 70);
    mouse.up();

    assertSelectedElements([]);
  });
});

describe("lasso reselection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("should allow ctrl+alt lasso reselection when starting inside the active common bounds", () => {
    const rectA = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rectB = API.createElement({
      type: "rectangle",
      x: 220,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "blue",
      fillStyle: "solid",
    });

    API.setElements([rectA, rectB]);
    mouse.select([rectA, rectB]);
    act(() => {
      h.app.setActiveTool({ type: "lasso" });
    });

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      mouse.downAt(110, 50);
      mouse.moveTo(50, -20);

      expect(h.app.lassoTrail.hasCurrentTrail).toBe(true);

      mouse.moveTo(-20, 50);
      mouse.moveTo(50, 120);
      mouse.moveTo(110, 50);
      mouse.up();
    });

    assertSelectedElements([rectA.id]);
  });
});

describe("box-selection overlap mode", () => {
  const boxSelect = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    mouse.downAt(startX, startY);
    mouse.move(-1000, -1000);
    mouse.moveTo(endX, endY);
    mouse.up();
  };

  const boxSelectTopLeftAabbCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneElement, elementsMap);

    boxSelect(x1 + 2, y1 + 2, x1 + 12, y1 + 12);
  };

  const boxSelectTopRightAabbCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [, y1, x2] = getElementBounds(sceneElement, elementsMap);

    boxSelect(x2 - 12, y1 + 2, x2 - 2, y1 + 12);
  };

  const boxSelectTopLeftRotatedLocalBoundsCorner = (
    element: ReturnType<typeof API.createElement>,
  ) => {
    const sceneElement = API.getElement(element);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1, x2, y2] = getElementBounds(sceneElement, elementsMap, true);
    const center = pointFrom((x1 + x2) / 2, (y1 + y2) / 2);
    const [cornerX, cornerY] = pointRotateRads(
      pointFrom(x1, y1),
      center,
      sceneElement.angle,
    );

    boxSelect(cornerX - 4, cornerY - 4, cornerX + 4, cornerY + 4);
  };

  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{ appState: { boxSelectionMode: "overlap" } }}
      />,
    );
  });

  it("should select an element when the selection box partially overlaps it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, -20, 75, 70);

    assertSelectedElements([rect1.id]);
  });

  it("should not select a transparent rectangle when the selection box stays inside it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, 25, 75, 75);

    assertSelectedElements([]);
  });

  it("should select a transparent rectangle when the selection box crosses its outline", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(25, 25, 125, 75);

    assertSelectedElements([rect1.id]);
  });

  it("should not select a rotated transparent rectangle when the selection box stays inside it", () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([rect1]);

    boxSelect(40, 40, 60, 60);

    assertSelectedElements([]);
  });

  it("should select a rotated rounded rectangle when the selection box contains its outline but not its bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 180,
      angle: Math.PI / 6,
      backgroundColor: "transparent",
      fillStyle: "solid",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      roughness: 0,
    });

    API.setElements([rect]);

    const sceneRect = API.getElement(rect);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [boundsX1, boundsY1, boundsX2, boundsY2] = getElementBounds(
      sceneRect,
      elementsMap,
    );
    const [outlineX1, outlineY1, outlineX2, outlineY2] = getOutlineBounds(rect);

    expect(outlineX1).toBeGreaterThan(boundsX1 - 1);
    expect(outlineY1).toBeGreaterThan(boundsY1 - 1);
    expect(outlineX2).toBeLessThan(boundsX2 + 1);
    expect(outlineY2).toBeLessThan(boundsY2 + 1);

    boxSelect(
      outlineX1 - (outlineX1 - boundsX1) / 2,
      outlineY1 - (outlineY1 - boundsY1) / 2,
      outlineX2 + (boundsX2 - outlineX2) / 2,
      outlineY2 + (boundsY2 - outlineY2) / 2,
    );

    assertSelectedElements([rect.id]);
  });

  it("should not select a filled rotated rectangle when the selection box only overlaps its axis-aligned bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    boxSelectTopLeftAabbCorner(rect);

    assertSelectedElements([]);
  });

  it("should not select a filled ellipse when the selection box only overlaps its bounds corner", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([ellipse]);

    boxSelectTopRightAabbCorner(ellipse);

    assertSelectedElements([]);
  });

  it("should not select a filled diamond when the selection box only overlaps its bounds corner", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([diamond]);

    boxSelectTopRightAabbCorner(diamond);

    assertSelectedElements([]);
  });

  it("should not select a filled rotated ellipse when the selection box only overlaps its axis-aligned bounds", () => {
    const ellipse = API.createElement({
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([ellipse]);

    boxSelectTopLeftRotatedLocalBoundsCorner(ellipse);

    assertSelectedElements([]);
  });

  it("should not select a filled rotated diamond when the selection box only overlaps its rotated local bounds", () => {
    const diamond = API.createElement({
      type: "diamond",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([diamond]);

    boxSelectTopLeftRotatedLocalBoundsCorner(diamond);

    assertSelectedElements([]);
  });

  it("should not select rotated text when the selection box only overlaps its axis-aligned bounds", () => {
    const text = API.createElement({
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      text: "test",
    });

    API.setElements([text]);

    boxSelect(-18, -18, -8, -8);

    assertSelectedElements([]);
  });

  it("should not select rotated image when the selection box only overlaps its axis-aligned bounds", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      fileId: "file_A",
      status: "saved",
    });

    API.setElements([image]);

    boxSelect(-18, -18, -8, -8);

    assertSelectedElements([]);
  });

  it("should deselect a selected rotated rectangle when clicking in the empty corner of its axis-aligned bounds", () => {
    const rect = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "red",
      fillStyle: "solid",
    });

    API.setElements([rect]);

    mouse.clickAt(50, 50);
    assertSelectedElements([rect.id]);

    const sceneRect = API.getElement(rect);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneRect, elementsMap);

    mouse.clickAt(x1 + 2, y1 + 2);

    assertSelectedElements([]);
  });

  it("should not select a line when the selection box only overlaps its bounds", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
    });

    API.setElements([line]);

    boxSelect(20, 50, 30, 60);

    assertSelectedElements([]);
  });

  it("should not click-select rotated freedraw in the corner of its axis-aligned bounds", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: Math.PI / 4,
      backgroundColor: "transparent",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(0, 100),
        pointFrom<LocalPoint>(0, 0),
      ],
    });

    API.setElements([freedraw]);

    const sceneFreedraw = API.getElement(freedraw);
    const elementsMap = h.scene.getNonDeletedElementsMap();
    const [x1, y1] = getElementBounds(sceneFreedraw, elementsMap);

    mouse.clickAt(x1 + 2, y1 + 2);

    assertSelectedElements([]);
  });

  it("should not select a freedraw when the selection box only overlaps its bounds", () => {
    const freedraw = API.createElement({
      type: "freedraw",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 50),
        pointFrom<LocalPoint>(100, 100),
      ],
    });

    API.setElements([freedraw]);

    boxSelect(20, 50, 30, 60);

    assertSelectedElements([]);
  });

  it("should not select a transparent framed element when the selection box stays inside its clipped bounds", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });
    const rect1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 10,
      width: 100,
      height: 80,
      frameId: frame.id,
      backgroundColor: "transparent",
      fillStyle: "solid",
    });

    API.setElements([frame, rect1]);

    boxSelect(60, 20, 90, 60);

    assertSelectedElements([]);
  });
});

describe("inner box-selection", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });
  it("selecting elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    });
    API.setElements([rect1, rect2, rect3]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.move(-1000, -1000);
      mouse.moveTo(290, 290);
      mouse.up();

      assertSelectedElements([rect2.id, rect3.id]);
    });
  });

  it("selecting grouped elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    API.setElements([rect1, rect2, rect3]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.move(-1000, -1000);
      mouse.moveTo(rect2.x + rect2.width + 10, rect2.y + rect2.height + 10);
      mouse.up();

      assertSelectedElements([rect2.id, rect3.id]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
    });
  });

  it("selecting & deselecting grouped elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    API.setElements([rect1, rect2, rect3]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(rect2.x - 20, rect2.y - 20);
      mouse.move(-1000, -1000);
      mouse.moveTo(rect2.x + rect2.width + 10, rect2.y + rect2.height + 10);
      assertSelectedElements([rect2.id, rect3.id]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
      mouse.moveTo(rect2.x - 10, rect2.y - 10);
      assertSelectedElements([rect1.id]);
      expect(h.state.selectedGroupIds).toEqual({});
      mouse.up();
    });
  });
});

describe("selection element", () => {
  it("create selection element on pointer down", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });

    expect(renderInteractiveScene).toHaveBeenCalledTimes(3);
    expect(renderStaticScene).toHaveBeenCalledTimes(3);
    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 100]);
    expect([selectionElement.width, selectionElement.height]).toEqual([0, 0]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("resize selection element on pointer move", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });

    expect(renderInteractiveScene).toHaveBeenCalledTimes(5);
    expect(renderStaticScene).toHaveBeenCalledTimes(3);
    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 30]);
    expect([selectionElement.width, selectionElement.height]).toEqual([90, 70]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("remove selection element on pointer up", async () => {
    const { getByToolName, container } = await render(<Excalidraw />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas.interactive")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(6);
    expect(renderStaticScene).toHaveBeenCalledTimes(3);
    expect(h.state.selectionElement).toBeNull();
  });
});

describe("select single element on the scene", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("rectangle", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(8);
    expect(renderStaticScene).toHaveBeenCalledTimes(7);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("diamond", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("diamond");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(8);
    expect(renderStaticScene).toHaveBeenCalledTimes(7);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("ellipse", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(8);
    expect(renderStaticScene).toHaveBeenCalledTimes(7);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("arrow", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("arrow");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    /*
        1 2 3 4 5 6 7 8 9
      1
      2     x
      3
      4       .
      5
      6
      7           x
      8
      9
    */

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the arrow
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(10);
    expect(renderStaticScene).toHaveBeenCalledTimes(9);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("arrow escape", async () => {
    const { getByToolName, container } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );
    const canvas = container.querySelector("canvas.interactive")!;
    {
      // create element
      const tool = getByToolName("line");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: -1000, clientY: -1000 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    /*
        1 2 3 4 5 6 7 8 9
      1
      2     x
      3
      4       .
      5
      6
      7           x
      8
      9
    */

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the arrow
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderInteractiveScene).toHaveBeenCalledTimes(10);
    expect(renderStaticScene).toHaveBeenCalledTimes(9);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});

describe("tool locking & selection", () => {
  it("should not select newly created element while tool is locked", async () => {
    await render(<Excalidraw />);

    UI.clickTool("lock");
    expect(h.state.activeTool.locked).toBe(true);

    for (const { value } of Object.values(SHAPES)) {
      if (
        value !== "image" &&
        value !== "selection" &&
        value !== "eraser" &&
        value !== "arrow" &&
        value !== "hand" &&
        value !== "laser"
      ) {
        const element = UI.createElement(value);
        expect(h.state.selectedElementIds[element.id]).not.toBe(true);
      }
    }
  });
});

describe("selectedElementIds stability", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("box-selection should be stable when not changing selection", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    API.setElements([rectangle]);

    const selectedElementIds_1 = h.state.selectedElementIds;

    mouse.downAt(-100, -100);
    mouse.moveTo(-50, -50);
    mouse.up();

    expect(h.state.selectedElementIds).toBe(selectedElementIds_1);

    mouse.downAt(-50, -50);
    mouse.move(-1000, -1000);
    mouse.moveTo(50, 50);

    const selectedElementIds_2 = h.state.selectedElementIds;

    expect(selectedElementIds_2).toEqual({ [rectangle.id]: true });

    mouse.moveTo(60, 60);

    // box-selecting further without changing selection should keep
    // selectedElementIds stable (the same object)
    expect(h.state.selectedElementIds).toBe(selectedElementIds_2);

    mouse.up();

    expect(h.state.selectedElementIds).toBe(selectedElementIds_2);
  });
});

describe("deselecting", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("esc unwinds nested group editing before deselecting", () => {
    const rectA = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      groupIds: ["inner", "outer"],
    });
    const rectB = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      groupIds: ["outer"],
    });
    const rectC = API.createElement({
      type: "rectangle",
      x: 200,
      y: 0,
      groupIds: ["inner", "outer"],
    });

    API.setElements([rectA, rectB, rectC]);

    mouse.select(rectA);
    assertSelectedElements(rectA, rectB, rectC);
    expect(h.state.editingGroupId).toBeNull();

    mouse.doubleClickOn(rectA);
    assertSelectedElements(rectA, rectC);
    expect(h.state.editingGroupId).toBe("outer");

    mouse.doubleClickOn(rectA);
    assertSelectedElements(rectA);
    expect(h.state.editingGroupId).toBe("inner");

    Keyboard.keyPress(KEYS.ESCAPE);
    assertSelectedElements(rectA, rectC);
    expect(h.state.editingGroupId).toBe("outer");

    Keyboard.keyPress(KEYS.ESCAPE);
    assertSelectedElements(rectA, rectB, rectC);
    expect(h.state.editingGroupId).toBeNull();
    expect(h.state.selectedGroupIds).toEqual({ outer: true });

    Keyboard.keyPress(KEYS.ESCAPE);
    expect(API.getSelectedElements()).toEqual([]);
    expect(h.state.editingGroupId).toBeNull();
    expect(h.state.selectedGroupIds).toEqual({});
  });
});
