import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "./test-utils";
import App from "../components/App";
import * as Renderer from "../renderer/renderScene";
import { reseed } from "../random";
import { bindOrUnbindLinearElement } from "../element/binding";
import {
  ExcalidrawLinearElement,
  NonDeleted,
  ExcalidrawRectangleElement,
} from "../element/types";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("move element", () => {
  it("rectangle", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;

    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);

      expect(renderScene).toHaveBeenCalledTimes(5);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(1);
      expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
      expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);

      renderScene.mockClear();
    }

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect([h.elements[0].x, h.elements[0].y]).toEqual([0, 40]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("rectangles with binding arrow", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;

    {
      // create the first rectangle
      const toolRect = getByToolName("rectangle");
      fireEvent.click(toolRect);
      fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 });
      fireEvent.pointerMove(canvas, { clientX: 100, clientY: 1000 });
      fireEvent.pointerUp(canvas);

      // create the second rectangle
      fireEvent.click(toolRect);
      fireEvent.pointerDown(canvas, { clientX: 200, clientY: 0 });
      fireEvent.pointerMove(canvas, { clientX: 300, clientY: 1000 });
      fireEvent.pointerUp(canvas);

      // create a line
      const toolLine = getByToolName("line");
      fireEvent.click(toolLine);
      fireEvent.pointerDown(canvas, { clientX: 110, clientY: 50 });
      fireEvent.pointerMove(canvas, { clientX: 190, clientY: 51 });
      fireEvent.pointerUp(canvas);

      // bind line to two rectangles
      bindOrUnbindLinearElement(
        h.elements[2] as NonDeleted<ExcalidrawLinearElement>,
        h.elements[0] as ExcalidrawRectangleElement,
        h.elements[1] as ExcalidrawRectangleElement,
      );

      // select the second rectangles
      fireEvent.pointerDown(canvas, { clientX: 200, clientY: 0 });
      fireEvent.pointerUp(canvas);

      expect(renderScene).toHaveBeenCalledTimes(19);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(3);
      expect(h.state.selectedElementIds[h.elements[1].id]).toBeTruthy();
      expect([h.elements[0].x, h.elements[0].y]).toEqual([0, 0]);
      expect([h.elements[1].x, h.elements[1].y]).toEqual([200, 0]);
      expect([h.elements[2].x, h.elements[2].y]).toEqual([110, 50]);
      expect([h.elements[2].width, h.elements[2].height]).toEqual([80, 1]);

      renderScene.mockClear();
    }

    // Move selected rectangle
    fireEvent.keyDown(canvas, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(canvas, { key: "ArrowDown", code: "ArrowDown" });

    // Check that the arrow size has been changed according to moving the rectangle
    expect(renderScene).toHaveBeenCalledTimes(3);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(3);
    expect(h.state.selectedElementIds[h.elements[1].id]).toBeTruthy();
    expect([h.elements[0].x, h.elements[0].y]).toEqual([0, 0]);
    expect([h.elements[1].x, h.elements[1].y]).toEqual([201, 2]);
    expect([Math.round(h.elements[2].x), Math.round(h.elements[2].y)]).toEqual([
      110,
      50,
    ]);
    expect([
      Math.round(h.elements[2].width),
      Math.round(h.elements[2].height),
    ]).toEqual([81, 2]);

    // h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});

describe("duplicate element on move when ALT is clicked", () => {
  it("rectangle", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;

    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);

      expect(renderScene).toHaveBeenCalledTimes(5);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(1);
      expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
      expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);

      renderScene.mockClear();
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
    expect(renderScene).toHaveBeenCalledTimes(5);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(2);

    // previous element should stay intact
    expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);
    expect([h.elements[1].x, h.elements[1].y]).toEqual([-10, 60]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});
