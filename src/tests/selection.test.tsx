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

describe.skip("selection element", () => {
  it("create selection element on pointer down", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });

    expect(renderScene).toHaveBeenCalledTimes(1);
    const selectionElement = renderScene.mock.calls[0][1]!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 100]);
    expect([selectionElement.width, selectionElement.height]).toEqual([0, 0]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("resize selection element on pointer move", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(2);
    const selectionElement = renderScene.mock.calls[1][1]!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 30]);
    expect([selectionElement.width, selectionElement.height]).toEqual([90, 70]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("remove selection element on pointer up", () => {
    const { getByToolName, container } = render(<App />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    const selectionElement = renderScene.mock.calls[2][1];
    expect(selectionElement).toBeNull();
  });
});

describe.skip("select single element on the scene", () => {
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
      fireEvent.keyDown(document, { key: KEYS.ESCAPE });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(7);
    const elements = renderScene.mock.calls[6][0];
    const selectionElement = renderScene.mock.calls[6][1];
    expect(selectionElement).toBeNull();
    expect(elements.length).toEqual(1);
    expect(elements[0].isSelected).toBeTruthy();
  });

  it("diamond", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("diamond");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, { key: KEYS.ESCAPE });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(7);
    const elements = renderScene.mock.calls[6][0];
    const selectionElement = renderScene.mock.calls[6][1];
    expect(selectionElement).toBeNull();
    expect(elements.length).toEqual(1);
    expect(elements[0].isSelected).toBeTruthy();
  });

  it("ellipse", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, { key: KEYS.ESCAPE });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(7);
    const elements = renderScene.mock.calls[6][0];
    const selectionElement = renderScene.mock.calls[6][1];
    expect(selectionElement).toBeNull();
    expect(elements.length).toEqual(1);
    expect(elements[0].isSelected).toBeTruthy();
  });

  it("arrow", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("arrow");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, { key: KEYS.ESCAPE });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(7);
    const elements = renderScene.mock.calls[6][0];
    const selectionElement = renderScene.mock.calls[6][1];
    expect(selectionElement).toBeNull();
    expect(elements.length).toEqual(1);
    expect(elements[0].isSelected).toBeTruthy();
  });

  it("arrow", () => {
    const { getByToolName, container } = render(<App />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("line");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, { key: KEYS.ESCAPE });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(7);
    const elements = renderScene.mock.calls[6][0];
    const selectionElement = renderScene.mock.calls[6][1];
    expect(selectionElement).toBeNull();
    expect(elements.length).toEqual(1);
    expect(elements[0].isSelected).toBeTruthy();
  });
});
