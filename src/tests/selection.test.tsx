import React from "react";
import ReactDOM from "react-dom";
import {
  render,
  fireEvent,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";
import ExcalidrawApp from "../excalidraw-app";
import * as Renderer from "../renderer/renderScene";
import { KEYS } from "../keys";
import { reseed } from "../random";
import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { getSelectedElements } from "../scene";

// Unmount ReactDOM from root
ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const renderScene = jest.spyOn(Renderer, "renderScene");
beforeEach(() => {
  localStorage.clear();
  renderScene.mockClear();
  reseed(7);
});

const { h } = window;

const mouse = new Pointer("mouse");

const assertSelectedIds = (ids: string[]) => {
  expect(
    getSelectedElements(h.app.getSceneElements(), h.state).map((el) => el.id),
  ).toEqual(ids);
};

describe("inner box-selection", () => {
  beforeEach(async () => {
    await render(<ExcalidrawApp />);
  });
  it("selecting elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
    });
    h.elements = [rect1, rect2, rect3];
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.moveTo(290, 290);
      mouse.up();

      assertSelectedIds([rect2.id, rect3.id]);
    });
  });

  it("selecting grouped elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    h.elements = [rect1, rect2, rect3];

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(40, 40);
      mouse.moveTo(rect2.x + rect2.width + 10, rect2.y + rect2.height + 10);
      mouse.up();

      assertSelectedIds([rect2.id, rect3.id]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
    });
  });

  it("selecting & deselecting grouped elements visually nested inside another", async () => {
    const rect1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const rect2 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    const rect3 = API.createElement({
      type: "rectangle",
      x: 150,
      y: 150,
      width: 50,
      height: 50,
      groupIds: ["A"],
    });
    h.elements = [rect1, rect2, rect3];
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      mouse.downAt(rect2.x - 20, rect2.x - 20);
      mouse.moveTo(rect2.x + rect2.width + 10, rect2.y + rect2.height + 10);
      assertSelectedIds([rect2.id, rect3.id]);
      expect(h.state.selectedGroupIds).toEqual({ A: true });
      mouse.moveTo(rect2.x - 10, rect2.y - 10);
      assertSelectedIds([rect1.id]);
      expect(h.state.selectedGroupIds).toEqual({});
      mouse.up();
    });
  });
});

describe("selection element", () => {
  it("create selection element on pointer down", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });

    expect(renderScene).toHaveBeenCalledTimes(4);
    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 100]);
    expect([selectionElement.width, selectionElement.height]).toEqual([0, 0]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("resize selection element on pointer move", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });

    expect(renderScene).toHaveBeenCalledTimes(5);
    const selectionElement = h.state.selectionElement!;
    expect(selectionElement).not.toBeNull();
    expect(selectionElement.type).toEqual("selection");
    expect([selectionElement.x, selectionElement.y]).toEqual([60, 30]);
    expect([selectionElement.width, selectionElement.height]).toEqual([90, 70]);

    // TODO: There is a memory leak if pointer up is not triggered
    fireEvent.pointerUp(canvas);
  });

  it("remove selection element on pointer up", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    // select tool
    const tool = getByToolName("selection");
    fireEvent.click(tool);

    const canvas = container.querySelector("canvas")!;
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(6);
    expect(h.state.selectionElement).toBeNull();
  });
});

describe("select single element on the scene", () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

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
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(10);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("diamond", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("diamond");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(10);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("ellipse", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("ellipse");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the rectangle
    fireEvent.pointerDown(canvas, { clientX: 45, clientY: 20 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(10);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("arrow", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("arrow");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    /*
        1 2 3 4 5 6 7 8 9
      1
      2     x
      3
      4       .
      5
      6
      7           x
      8
      9
    */

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the arrow
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(10);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();
    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("arrow escape", async () => {
    const { getByToolName, container } = await render(<ExcalidrawApp />);
    const canvas = container.querySelector("canvas")!;
    {
      // create element
      const tool = getByToolName("line");
      fireEvent.click(tool);
      fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
      fireEvent.pointerMove(canvas, { clientX: 60, clientY: 70 });
      fireEvent.pointerUp(canvas);
      fireEvent.keyDown(document, {
        key: KEYS.ESCAPE,
      });
    }

    /*
        1 2 3 4 5 6 7 8 9
      1
      2     x
      3
      4       .
      5
      6
      7           x
      8
      9
    */

    const tool = getByToolName("selection");
    fireEvent.click(tool);
    // click on a line on the arrow
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    expect(renderScene).toHaveBeenCalledTimes(10);
    expect(h.state.selectionElement).toBeNull();
    expect(h.elements.length).toEqual(1);
    expect(h.state.selectedElementIds[h.elements[0].id]).toBeTruthy();

    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });
});
