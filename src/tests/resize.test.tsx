import React from "react";
import ReactDOM from "react-dom";
import { render, fireEvent } from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import * as Renderer from "../renderer/renderScene";
import { reseed } from "../random";
import { UI, Pointer, Keyboard } from "./helpers/ui";
import { getTransformHandles } from "../element/transformHandles";

const mouse = new Pointer("mouse");

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
});

const { h } = window;

describe("resize element", () => {
  it("rectangle", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    const canvas = container.querySelector("canvas")!;

    {
      // create element
      const tool = getByToolName("rectangle");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);

      expect(renderScene).toHaveBeenCalledTimes(6);
      expect(h.state.selectionElement).toBeNull();
      expect(h.elements.length).toEqual(1);
      expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
      expect([h.elements[0].x, h.elements[0].y]).toEqual([30, 20]);

      expect([h.elements[0].width, h.elements[0].height]).toEqual([30, 50]);

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
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect([h.elements[0].x, h.elements[0].y]).toEqual([29, 47]);
    expect([h.elements[0].width, h.elements[0].height]).toEqual([30, 50]);

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});

describe("resize element with aspect ratio when SHIFT is clicked", () => {
  it("rectangle", async () => {
    await render(<ExcalidrawApp />);

    const rectangle = UI.createElement("rectangle", {
      x: 0,
      width: 30,
      height: 50,
    });

    mouse.select(rectangle);

    const se = getTransformHandles(rectangle, h.state.zoom, "mouse").se!;
    const clientX = se[0] + se[2] / 2;
    const clientY = se[1] + se[3] / 2;
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.reset();
      mouse.down(clientX, clientY);
      mouse.move(1, 1);
      mouse.up();
    });
    expect([h.elements[0].width, h.elements[0].height]).toEqual([51, 51]);
  });
});
