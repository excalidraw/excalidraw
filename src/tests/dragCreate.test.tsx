import React from "react";
import ReactDOM from "react-dom";
import { App } from "../components/App";
import * as Renderer from "../renderer/renderScene";
import { KEYS } from "../keys";
import { render, fireEvent } from "./test-utils";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
});

const { __TEST__: h } = window;

describe("add element to the scene when pointer dragging long enough", () => {
  it("rectangle", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // move to (60,70)
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();

    expect(h.elements.length).toEqual(1);
    expect(h.elements[0].type).toEqual("rectangle");
    expect(h.elements[0].x).toEqual(30);
    expect(h.elements[0].y).toEqual(20);
    expect(h.elements[0].width).toEqual(30); // 60 - 30
    expect(h.elements[0].height).toEqual(50); // 70 - 20
  });

  it("ellipse", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("ellipse");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // move to (60,70)
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();

    expect(h.elements.length).toEqual(1);
    expect(h.elements[0].type).toEqual("ellipse");
    expect(h.elements[0].x).toEqual(30);
    expect(h.elements[0].y).toEqual(20);
    expect(h.elements[0].width).toEqual(30); // 60 - 30
    expect(h.elements[0].height).toEqual(50); // 70 - 20
  });

  it("diamond", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("diamond");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // move to (60,70)
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();

    expect(h.elements.length).toEqual(1);
    expect(h.elements[0].type).toEqual("diamond");
    expect(h.elements[0].x).toEqual(30);
    expect(h.elements[0].y).toEqual(20);
    expect(h.elements[0].width).toEqual(30); // 60 - 30
    expect(h.elements[0].height).toEqual(50); // 70 - 20
  });

  it("arrow", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("arrow");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // move to (60,70)
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();

    expect(h.elements.length).toEqual(1);
    expect(h.elements[0].type).toEqual("arrow");
    expect(h.elements[0].x).toEqual(30);
    expect(h.elements[0].y).toEqual(20);
    expect(h.elements[0].points.length).toEqual(2);
    expect(h.elements[0].points[0]).toEqual([0, 0]);
    expect(h.elements[0].points[1]).toEqual([30, 50]); // (60 - 30, 70 - 20)
  });

  it("line", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("line");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // move to (60,70)
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();

    expect(h.elements.length).toEqual(1);
    expect(h.elements[0].type).toEqual("line");
    expect(h.elements[0].x).toEqual(30);
    expect(h.elements[0].y).toEqual(20);
    expect(h.elements[0].points.length).toEqual(2);
    expect(h.elements[0].points[0]).toEqual([0, 0]);
    expect(h.elements[0].points[1]).toEqual([30, 50]); // (60 - 30, 70 - 20)
  });
});

describe("do not add element to the scene if size is too small", () => {
  it("rectangle", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    expect(h.appState.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(0);
  });

  it("ellipse", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("ellipse");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    expect(h.appState.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(0);
  });

  it("diamond", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("diamond");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    expect(h.appState.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(0);
  });

  it("arrow", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("arrow");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    // we need to finalize it because arrows and lines enter multi-mode
    fireEvent.keyDown(document, { key: KEYS.ENTER });

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(0);
  });

  it("line", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("line");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;

    // start from (30, 20)
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });

    // finish (position does not matter)
    fireEvent.pointerUp(canvas);

    // we need to finalize it because arrows and lines enter multi-mode
    fireEvent.keyDown(document, { key: KEYS.ENTER });

    expect(renderScene).toHaveBeenCalledTimes(4);
    expect(h.appState.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(0);
  });
});
