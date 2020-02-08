import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "@testing-library/react";
import { App } from "../index";
import * as Renderer from "../renderer/renderScene";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
});

describe("selection element", () => {
  it("create selection element on mouse down", () => {
    const { getByTitle, container } = render(<App />);
    // select tool
    const tool = getByTitle("Selection — S, 1");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 60, clientY: 100 });

    expect(renderScene).toHaveBeenCalledTimes(1);
    const selectionElement = renderScene.mock.calls[0][1]!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 100]);
    expect([selectionElement.width, selectionElement.height]).toEqual([0, 0]);

    // TODO: There is a memory leak if mouse up is not triggered
    fireEvent.mouseUp(canvas);
  });

  it("resize selection element on mouse move", () => {
    const { getByTitle, container } = render(<App />);
    // select tool
    const tool = getByTitle("Selection — S, 1");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(2);
    const selectionElement = renderScene.mock.calls[1][1]!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 30]);
    expect([selectionElement.width, selectionElement.height]).toEqual([90, 70]);

    // TODO: There is a memory leak if mouse up is not triggered
    fireEvent.mouseUp(canvas);
  });

  it("remove selection element on mouse up", () => {
    const { getByTitle, container } = render(<App />);
    // select tool
    const tool = getByTitle("Selection — S, 1");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.mouseDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 30 });
    fireEvent.mouseUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    const selectionElement = renderScene.mock.calls[2][1];
    expect(selectionElement).toBeNull();
  });
});
