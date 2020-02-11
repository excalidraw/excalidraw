import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "./test-utils";
import { App } from "../index";
import * as Renderer from "../renderer/renderScene";
import { KEYS } from "../keys";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
});

describe("remove shape in non linear elements", () => {
  it("rectangle", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.mouseUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(3);
    const elements = renderScene.mock.calls[2][0];
    expect(elements.length).toEqual(0);
  });

  it("ellipse", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("ellipse");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.mouseUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(3);
    const elements = renderScene.mock.calls[2][0];
    expect(elements.length).toEqual(0);
  });

  it("diamond", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("diamond");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.mouseUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(3);
    const elements = renderScene.mock.calls[2][0];
    expect(elements.length).toEqual(0);
  });
});

describe("multi point mode in linear elements", () => {
  it("arrow", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("arrow");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    // first point is added on mouse down
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 30 });

    // second point, enable multi point
    fireEvent.mouseUp(canvas, { clientX: 30, clientY: 30 });
    fireEvent.mouseMove(canvas, { clientX: 50, clientY: 60 });

    // third point
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 60 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 140 });

    // done
    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);
    fireEvent.keyDown(document, { key: KEYS.ENTER });

    expect(renderScene).toHaveBeenCalledTimes(8);
    const elements = renderScene.mock.calls[7][0];
    expect(elements.length).toEqual(1);

    expect(elements[0].type).toEqual("arrow");
    expect(elements[0].x).toEqual(30);
    expect(elements[0].y).toEqual(30);
    expect(elements[0].points).toEqual([
      [0, 0],
      [20, 30],
      [70, 110],
    ]);
  });

  it("line", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("line");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    // first point is added on mouse down
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 30 });

    // second point, enable multi point
    fireEvent.mouseUp(canvas, { clientX: 30, clientY: 30 });
    fireEvent.mouseMove(canvas, { clientX: 50, clientY: 60 });

    // third point
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 60 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 140 });

    // done
    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);
    fireEvent.keyDown(document, { key: KEYS.ENTER });

    expect(renderScene).toHaveBeenCalledTimes(8);
    const elements = renderScene.mock.calls[7][0];
    expect(elements.length).toEqual(1);

    expect(elements[0].type).toEqual("line");
    expect(elements[0].x).toEqual(30);
    expect(elements[0].y).toEqual(30);
    expect(elements[0].points).toEqual([
      [0, 0],
      [20, 30],
      [70, 110],
    ]);
  });
});
