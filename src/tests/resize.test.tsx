import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "./test-utils";
import { App } from "../index";
import * as Renderer from "../renderer/renderScene";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
});

describe.skip("resize element", () => {
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

      expect(renderScene).toHaveBeenCalledTimes(4);
      const elements = renderScene.mock.calls[3][0];
      const selectionElement = renderScene.mock.calls[3][1];
      expect(selectionElement).toBeNull();
      expect(elements.length).toEqual(1);
      expect(elements[0].isSelected).toBeTruthy();
      expect([elements[0].x, elements[0].y]).toEqual([30, 20]);

      renderScene.mockClear();
    }

    // select the element first
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas);

    // select a handler rectangle (top-left)
    fireEvent.pointerDown(canvas, { clientX: 21, clientY: 13 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(5);
    const elements = renderScene.mock.calls[4][0];
    expect(renderScene.mock.calls[4][1]).toBeNull();
    expect(elements.length).toEqual(1);
    expect([elements[0].x, elements[0].y]).toEqual([29, 47]);
    expect([elements[0].width, elements[0].height]).toEqual([31, 23]);
  });
});

describe.skip("resize element with aspect ratio when SHIFT is clicked", () => {
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

      expect(renderScene).toHaveBeenCalledTimes(4);
      const elements = renderScene.mock.calls[3][0];
      const selectionElement = renderScene.mock.calls[3][1];
      expect(selectionElement).toBeNull();
      expect(elements.length).toEqual(1);
      expect(elements[0].isSelected).toBeTruthy();
      expect([elements[0].x, elements[0].y]).toEqual([30, 20]);

      renderScene.mockClear();
    }

    // select the element first
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerUp(canvas);

    // select a handler rectangle (top-left)
    fireEvent.pointerDown(canvas, { clientX: 21, clientY: 13 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40, shiftKey: true });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(5);
    const elements = renderScene.mock.calls[4][0];
    expect(renderScene.mock.calls[4][1]).toBeNull();
    expect(elements.length).toEqual(1);
    expect([elements[0].x, elements[0].y]).toEqual([29, 39]);
    expect([elements[0].width, elements[0].height]).toEqual([31, 31]);
  });
});
