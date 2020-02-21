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

describe.skip("move element", () => {
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

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    const elements = renderScene.mock.calls[2][0];
    expect(renderScene.mock.calls[2][1]).toBeNull();
    expect(elements.length).toEqual(1);
    expect([elements[0].x, elements[0].y]).toEqual([0, 40]);
  });
});

describe.skip("duplicate element on move when ALT is clicked", () => {
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

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 20, altKey: true });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(3);
    const elements = renderScene.mock.calls[2][0];
    expect(renderScene.mock.calls[2][1]).toBeNull();
    expect(elements.length).toEqual(2);
    // previous element should stay intact
    expect([elements[0].x, elements[0].y]).toEqual([30, 20]);
    expect([elements[1].x, elements[1].y]).toEqual([0, 40]);
  });
});
