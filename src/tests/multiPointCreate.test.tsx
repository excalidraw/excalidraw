import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import * as Renderer from "../renderer/renderScene";
import { KEYS } from "../keys";
import { ExcalidrawLinearElement } from "../element/types";
import { reseed } from "../random";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("remove shape in non linear elements", () => {
  it("rectangle", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("rectangle");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(6);
    expect(h.elements.length).toEqual(0);
  });

  it("ellipse", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("ellipse");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(6);
    expect(h.elements.length).toEqual(0);
  });

  it("diamond", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("diamond");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(6);
    expect(h.elements.length).toEqual(0);
  });
});

describe("multi point mode in linear elements", () => {
  it("arrow", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("arrow");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
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
    fireEvent.keyDown(document, { key: KEYS.ENTER });

    expect(renderScene).toHaveBeenCalledTimes(13);
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
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("line");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
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
    fireEvent.keyDown(document, { key: KEYS.ENTER });

    expect(renderScene).toHaveBeenCalledTimes(13);
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
