import React from "react";
import { vi } from "vitest";

import { KEYS, reseed } from "@excalidraw/common";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import * as InteractiveScene from "../renderer/interactiveScene";
import * as StaticScene from "../renderer/staticScene";

import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
} from "./test-utils";

unmountComponent();

const renderInteractiveScene = vi.spyOn(
  InteractiveScene,
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

describe("Test dragCreate", () => {
  describe("add element to the scene when pointer dragging long enough", () => {
    it("rectangle", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);
      expect(h.elements[0].type).toEqual("rectangle");
      expect(h.elements[0].x).toEqual(30);
      expect(h.elements[0].y).toEqual(20);
      expect(h.elements[0].width).toEqual(30); // 60 - 30
      expect(h.elements[0].height).toEqual(50); // 70 - 20

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });

    it("ellipse", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);

      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);
      expect(h.elements[0].type).toEqual("ellipse");
      expect(h.elements[0].x).toEqual(30);
      expect(h.elements[0].y).toEqual(20);
      expect(h.elements[0].width).toEqual(30); // 60 - 30
      expect(h.elements[0].height).toEqual(50); // 70 - 20

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });

    it("diamond", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("diamond");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);
      expect(h.elements[0].type).toEqual("diamond");
      expect(h.elements[0].x).toEqual(30);
      expect(h.elements[0].y).toEqual(20);
      expect(h.elements[0].width).toEqual(30); // 60 - 30
      expect(h.elements[0].height).toEqual(50); // 70 - 20

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });

    it("arrow", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("arrow");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);

      const element = h.elements[0] as ExcalidrawLinearElement;

      expect(element.type).toEqual("arrow");
      expect(element.x).toEqual(30);
      expect(element.y).toEqual(20);
      expect(element.points.length).toEqual(2);
      expect(element.points[0]).toEqual([0, 0]);
      expect(element.points[1]).toEqual([30, 50]); // (60 - 30, 70 - 20)

      expect(h.elements.length).toMatchSnapshot();
      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });

    it("line", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("line");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // move to (60,70)
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();

      expect(h.elements.length).toEqual(1);

      const element = h.elements[0] as ExcalidrawLinearElement;

      expect(element.type).toEqual("line");
      expect(element.x).toEqual(30);
      expect(element.y).toEqual(20);
      expect(element.points.length).toEqual(2);
      expect(element.points[0]).toEqual([0, 0]);
      expect(element.points[1]).toEqual([30, 50]); // (60 - 30, 70 - 20)

      h.elements.forEach((element) => expect(element).toMatchSnapshot());
    });
  });

  describe("do not add element to the scene if size is too small", () => {
    beforeAll(() => {
      mockBoundingClientRect();
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

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });

    it("ellipse", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });

    it("diamond", async () => {
      const { getByToolName, container } = await render(<Excalidraw />);
      // select tool
      const tool = getByToolName("diamond");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `5`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`5`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });

    it("arrow", async () => {
      const { getByToolName, container } = await render(
        <Excalidraw handleKeyboardGlobally={true} />,
      );
      // select tool
      const tool = getByToolName("arrow");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      // we need to finalize it because arrows and lines enter multi-mode
      fireEvent.keyDown(document, {
        key: KEYS.ENTER,
      });

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `6`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });

    it("line", async () => {
      const { getByToolName, container } = await render(
        <Excalidraw handleKeyboardGlobally={true} />,
      );
      // select tool
      const tool = getByToolName("line");
      fireEvent.click(tool);

      const canvas = container.querySelector("canvas.interactive")!;

      // start from (30, 20)
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

      // finish (position does not matter)
      fireEvent.pointerUp(canvas);

      // we need to finalize it because arrows and lines enter multi-mode
      fireEvent.keyDown(document, {
        key: KEYS.ENTER,
      });

      expect(renderInteractiveScene.mock.calls.length).toMatchInlineSnapshot(
        `6`,
      );
      expect(renderStaticScene.mock.calls.length).toMatchInlineSnapshot(`6`);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(0);
    });
  });
});
